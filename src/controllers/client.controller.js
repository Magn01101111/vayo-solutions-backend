const mongoose = require('mongoose');
const Client = require('../models/client.model');
const User = require('../models/user.model');
const { ROLES } = require('../constants/roles');
const { validateRut, normalizeChileanPhone } = require('../utils/validators');
const {
  ok,
  created,
  fail,
  notFound,
  conflict,
  serverError,
} = require('../utils/response');

function mapClient(client) {
  // Si userId fue populado, exponemos el resumen de la cuenta de portal.
  // Si no, devolvemos solo el id (o null).
  let portalAccount = null;
  if (client.userId) {
    if (typeof client.userId === 'object' && client.userId._id) {
      // populado
      portalAccount = {
        id: client.userId._id,
        email: client.userId.email,
        isActive: client.userId.isActive,
      };
    } else {
      // solo el ObjectId
      portalAccount = { id: client.userId };
    }
  }

  return {
    id: client._id,
    name: client.name,
    company: client.company,
    rut: client.rut,
    email: client.email,
    phone: client.phone,
    address: client.address,
    notes: client.notes,
    isActive: client.isActive,
    createdBy: client.createdBy,
    portalAccount,
    hasPortalAccount: !!client.userId,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  };
}

// ── GET /api/clients ──────────────────────────────────────────────────────────
// Query: ?q=texto  ?active=true|false
async function getClients(req, res) {
  try {
    const filter = {};

    // Filtro de estado (por defecto solo activos)
    const activeParam = req.query.active;
    if (activeParam === 'false') {
      filter.isActive = false;
    } else if (activeParam === 'all') {
      // sin filtro de isActive
    } else {
      filter.isActive = true;
    }

    // Búsqueda por texto (nombre, empresa, RUT)
    if (req.query.q) {
      const re = { $regex: req.query.q, $options: 'i' };
      filter.$or = [{ name: re }, { company: re }, { rut: re }, { email: re }];
    }

    const clients = await Client.find(filter)
      .populate('createdBy', 'name email')
      .populate('userId', 'email isActive')
      .sort({ name: 1 });

    return ok(res, clients.map(mapClient));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── GET /api/clients/:id ──────────────────────────────────────────────────────
async function getClientById(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de cliente inválido');
    }

    const client = await Client.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('userId', 'email isActive');

    if (!client) return notFound(res, 'Cliente no encontrado');

    return ok(res, mapClient(client));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── POST /api/clients ─────────────────────────────────────────────────────────
async function createClient(req, res) {
  try {
    const { name, company, rut, email, phone, address, notes } = req.body;

    // ── Validar / normalizar RUT (opcional, pero si viene debe ser válido) ───
    let canonicalRut = null;
    if (rut) {
      canonicalRut = validateRut(rut);
      if (!canonicalRut) return fail(res, 'RUT inválido. Verifica el dígito verificador.');

      const existsRut = await Client.findOne({ rut: canonicalRut });
      if (existsRut) return conflict(res, 'El RUT ya está registrado');
    }

    // ── Normalizar teléfono (opcional, pero si viene debe ser válido) ─────────
    let canonicalPhone = null;
    if (phone) {
      canonicalPhone = normalizeChileanPhone(phone);
      if (!canonicalPhone) return fail(res, 'Teléfono inválido. Debe ser un móvil chileno.');
    }

    const client = await Client.create({
      name,
      company,
      rut:   canonicalRut,
      email,
      phone: canonicalPhone,
      address,
      notes,
      createdBy: req.user.id,
    });

    return created(res, mapClient(client));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── PUT /api/clients/:id ──────────────────────────────────────────────────────
async function updateClient(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de cliente inválido');
    }

    const allowed = ['name', 'company', 'rut', 'email', 'phone', 'address', 'notes', 'isActive'];
    const updates = {};
    allowed.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    // ── Validar / normalizar RUT si se está actualizando ─────────────────────
    if (updates.rut !== undefined) {
      if (updates.rut === '' || updates.rut === null) {
        updates.rut = null;
      } else {
        const canonicalRut = validateRut(updates.rut);
        if (!canonicalRut) return fail(res, 'RUT inválido. Verifica el dígito verificador.');

        // Asegurar unicidad — pero permitir mantener el mismo RUT del propio cliente
        const taken = await Client.findOne({
          rut: canonicalRut,
          _id: { $ne: req.params.id },
        });
        if (taken) return conflict(res, 'El RUT ya está registrado por otro cliente');

        updates.rut = canonicalRut;
      }
    }

    // ── Normalizar teléfono si se está actualizando ──────────────────────────
    if (updates.phone !== undefined) {
      if (updates.phone === '' || updates.phone === null) {
        updates.phone = null;
      } else {
        const canonicalPhone = normalizeChileanPhone(updates.phone);
        if (!canonicalPhone) return fail(res, 'Teléfono inválido. Debe ser un móvil chileno.');
        updates.phone = canonicalPhone;
      }
    }

    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'name email')
      .populate('userId', 'email isActive');

    if (!client) return notFound(res, 'Cliente no encontrado');

    // Cascada: si se reactiva el cliente y tiene cuenta de portal, reactivarla.
    if (updates.isActive === true && client.userId) {
      await User.updateOne(
        { _id: client.userId._id ?? client.userId },
        { $set: { isActive: true } }
      );
    }

    return ok(res, mapClient(client));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── PATCH /api/clients/:id/deactivate ─────────────────────────────────────────
// Si el cliente tiene cuenta de portal vinculada, también se desactiva.
async function deactivateClient(req, res) {
  const session = await mongoose.startSession();
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de cliente inválido');
    }

    let client;

    await session.withTransaction(async () => {
      client = await Client.findByIdAndUpdate(
        req.params.id,
        { $set: { isActive: false } },
        { new: true, session }
      );

      if (!client) return; // se maneja afuera

      // Cascada: si tiene cuenta de portal, desactivarla también
      if (client.userId) {
        await User.updateOne(
          { _id: client.userId },
          { $set: { isActive: false } },
          { session }
        );
      }
    });

    if (!client) return notFound(res, 'Cliente no encontrado');

    return ok(res, {
      message: client.userId
        ? 'Cliente y cuenta de portal desactivados'
        : 'Cliente desactivado correctamente',
      id: client._id,
    });
  } catch (error) {
    return serverError(res, error);
  } finally {
    session.endSession();
  }
}

// ── POST /api/clients/:id/invite ──────────────────────────────────────────────
// ADMIN crea una cuenta de portal para un Client CRM existente.
// Body: { password: string }  — contraseña temporal definida por el admin.
// El Client debe tener email definido (es la credencial de login).
async function inviteToPortal(req, res) {
  const session = await mongoose.startSession();
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de cliente inválido');
    }

    const { password } = req.body;
    if (!password || password.length < 8) {
      return fail(res, 'La contraseña debe tener al menos 8 caracteres');
    }

    const client = await Client.findById(req.params.id);
    if (!client)            return notFound(res, 'Cliente no encontrado');
    if (!client.email)      return fail(res, 'El cliente no tiene email — agrégalo antes de invitarlo');
    if (client.userId)      return conflict(res, 'Este cliente ya tiene cuenta de portal');
    if (!client.isActive)   return fail(res, 'No se puede invitar a un cliente inactivo');

    // Verificar que el email no esté ya registrado en users
    const emailTaken = await User.findOne({ email: client.email });
    if (emailTaken) {
      return conflict(res, 'Ya existe una cuenta con ese correo. Vincula manualmente o cambia el email.');
    }

    let user;

    await session.withTransaction(async () => {
      const [createdUser] = await User.create(
        [{
          name:     client.name,
          email:    client.email,
          password,
          phone:    client.phone,
          role:     ROLES.CLIENTE,
          clientId: client._id,
        }],
        { session }
      );

      await Client.updateOne(
        { _id: client._id },
        { $set: { userId: createdUser._id } },
        { session }
      );

      user = createdUser;
    });

    return created(res, {
      message: 'Cuenta de portal creada correctamente',
      portalAccount: {
        id: user._id,
        email: user.email,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    return serverError(res, error);
  } finally {
    session.endSession();
  }
}

// ── DELETE /api/clients/:id/portal-access ─────────────────────────────────────
// Revoca el acceso al portal: elimina el User vinculado y limpia el ref.
// El Client CRM queda intacto (solo se le quita el portal).
async function revokePortalAccess(req, res) {
  const session = await mongoose.startSession();
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de cliente inválido');
    }

    const client = await Client.findById(req.params.id);
    if (!client)        return notFound(res, 'Cliente no encontrado');
    if (!client.userId) return fail(res, 'Este cliente no tiene cuenta de portal');

    await session.withTransaction(async () => {
      await User.deleteOne({ _id: client.userId }, { session });
      await Client.updateOne(
        { _id: client._id },
        { $set: { userId: null } },
        { session }
      );
    });

    return ok(res, { message: 'Acceso al portal revocado' });
  } catch (error) {
    return serverError(res, error);
  } finally {
    session.endSession();
  }
}

module.exports = {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deactivateClient,
  inviteToPortal,
  revokePortalAccess,
};
