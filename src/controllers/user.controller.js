const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/user.model');
const { ROLES } = require('../constants/roles');
const {
  ok,
  created,
  fail,
  notFound,
  conflict,
  serverError,
} = require('../utils/response');

function mapUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    position: user.position,
    role: user.role,
    isActive: user.isActive,
    profileImage: user.profileImage,
    createdAt: user.createdAt,
  };
}

// ── GET /api/users ────────────────────────────────────────────────────────────
// Query: ?role=COTIZADOR  (opcional)
async function getUsers(req, res) {
  try {
    const filter = {};
    if (req.query.role) {
      if (!Object.values(ROLES).includes(req.query.role)) {
        return fail(res, `Rol inválido. Valores posibles: ${Object.values(ROLES).join(', ')}`);
      }
      filter.role = req.query.role;
    }

    const users = await User.find(filter).sort({ name: 1 });
    return ok(res, users.map(mapUser));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── GET /api/users/:id ────────────────────────────────────────────────────────
async function getUserById(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de usuario inválido');
    }
    const user = await User.findById(req.params.id);
    if (!user) return notFound(res, 'Usuario no encontrado');
    return ok(res, mapUser(user));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── POST /api/users/cotizadores ───────────────────────────────────────────────
async function createCotizador(req, res) {
  try {
    const { name, email, password, phone, position } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return conflict(res, 'El correo ya está registrado');

    const user = await User.create({
      name, email, password, phone, position,
      role: ROLES.COTIZADOR,
    });

    return created(res, mapUser(user));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── PUT /api/users/cotizadores/:id ───────────────────────────────────────────
async function updateCotizador(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de usuario inválido');
    }

    const user = await User.findOne({ _id: req.params.id, role: ROLES.COTIZADOR });
    if (!user) return notFound(res, 'Cotizador no encontrado');

    const { name, email, phone, position } = req.body;

    if (email && email !== user.email) {
      const taken = await User.findOne({ email });
      if (taken) return conflict(res, 'El correo ya está en uso');
      user.email = email;
    }

    if (name)     user.name     = name;
    if (phone)    user.phone    = phone;
    if (position) user.position = position;

    await user.save();
    return ok(res, mapUser(user));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── PATCH /api/users/cotizadores/:id/deactivate ───────────────────────────────
async function deactivateCotizador(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de usuario inválido');
    }

    const user = await User.findOne({ _id: req.params.id, role: ROLES.COTIZADOR });
    if (!user) return notFound(res, 'Cotizador no encontrado');

    user.isActive = false;
    await user.save();

    return ok(res, { message: 'Cotizador desactivado correctamente', id: user._id });
  } catch (error) {
    return serverError(res, error);
  }
}

// ── POST /api/users/proveedores ───────────────────────────────────────────────
async function createProveedor(req, res) {
  try {
    const { name, email, password, phone, position } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return conflict(res, 'El correo ya está registrado');

    const user = await User.create({
      name, email, password, phone, position,
      role: ROLES.PROVEEDOR,
    });

    return created(res, mapUser(user));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── PUT /api/users/proveedores/:id ───────────────────────────────────────────
async function updateProveedor(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de usuario inválido');
    }

    const user = await User.findOne({ _id: req.params.id, role: ROLES.PROVEEDOR });
    if (!user) return notFound(res, 'Proveedor no encontrado');

    const { name, email, phone, position } = req.body;

    if (email && email !== user.email) {
      const taken = await User.findOne({ email });
      if (taken) return conflict(res, 'El correo ya está en uso');
      user.email = email;
    }

    if (name)     user.name     = name;
    if (phone)    user.phone    = phone;
    if (position) user.position = position;

    await user.save();
    return ok(res, mapUser(user));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── PATCH /api/users/proveedores/:id/deactivate ───────────────────────────────
async function deactivateProveedor(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de usuario inválido');
    }

    const user = await User.findOne({ _id: req.params.id, role: ROLES.PROVEEDOR });
    if (!user) return notFound(res, 'Proveedor no encontrado');

    user.isActive = false;
    await user.save();

    return ok(res, { message: 'Proveedor desactivado correctamente', id: user._id });
  } catch (error) {
    return serverError(res, error);
  }
}

module.exports = {
  getUsers,
  getUserById,
  createCotizador,
  updateCotizador,
  deactivateCotizador,
  createProveedor,
  updateProveedor,
  deactivateProveedor,
};

// NOTA: La gestión de usuarios CLIENTE NO vive aquí.
//   - Auto-registro:    POST /api/auth/register
//   - Invitar al portal: POST /api/clients/:id/invite
//   - Revocar acceso:    DELETE /api/clients/:id/portal-access
//   - Desactivar:        PATCH /api/clients/:id/deactivate (cascada al User)
// La razón: un CLIENTE es ante todo una entidad CRM (Client). La cuenta de
// portal es un atributo opcional de esa entidad.
