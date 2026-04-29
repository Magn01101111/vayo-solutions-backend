const mongoose = require('mongoose');
const Client = require('../models/client.model');
const {
  ok,
  created,
  fail,
  notFound,
  serverError,
} = require('../utils/response');

function mapClient(client) {
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

    const client = await Client.findById(req.params.id).populate(
      'createdBy',
      'name email'
    );

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

    const client = await Client.create({
      name,
      company,
      rut,
      email,
      phone,
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

    const allowed = ['name', 'company', 'rut', 'email', 'phone', 'address', 'notes'];
    const updates = {};
    allowed.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });

    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');

    if (!client) return notFound(res, 'Cliente no encontrado');

    return ok(res, mapClient(client));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── PATCH /api/clients/:id/deactivate ─────────────────────────────────────────
async function deactivateClient(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de cliente inválido');
    }

    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: false } },
      { new: true }
    );

    if (!client) return notFound(res, 'Cliente no encontrado');

    return ok(res, { message: 'Cliente desactivado correctamente', id: client._id });
  } catch (error) {
    return serverError(res, error);
  }
}

module.exports = {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deactivateClient,
};
