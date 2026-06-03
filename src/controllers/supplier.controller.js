const mongoose = require('mongoose');
const Supplier = require('../models/supplier.model');
const {
  ok,
  created,
  fail,
  notFound,
  serverError,
} = require('../utils/response');

function mapSupplier(s) {
  return {
    id: s._id,
    name: s.name,
    location: s.location,
    email: s.email,
    phone: s.phone,
    notes: s.notes,
    isActive: s.isActive,
    createdAt: s.createdAt,
  };
}

// ── GET /api/suppliers ─────────────────────────────────────────────────────────
// ?all=true (ADMIN) incluye inactivos.
async function getSuppliers(req, res) {
  try {
    const wantsAll = req.query.all === 'true' && req.user?.role === 'ADMIN';
    const filter = wantsAll ? {} : { isActive: true };
    const suppliers = await Supplier.find(filter).sort({ name: 1 });
    return ok(res, suppliers.map(mapSupplier));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── GET /api/suppliers/:id ─────────────────────────────────────────────────────
async function getSupplierById(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de proveedor inválido');
    }
    const s = await Supplier.findById(req.params.id);
    if (!s) return notFound(res, 'Proveedor no encontrado');
    return ok(res, mapSupplier(s));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── POST /api/suppliers ────────────────────────────────────────────────────────
async function createSupplier(req, res) {
  try {
    const { name, location, email, phone, notes } = req.body;
    if (!name || !name.trim()) return fail(res, 'El nombre es requerido');

    const s = await Supplier.create({ name, location, email, phone, notes });
    return created(res, mapSupplier(s));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── PUT /api/suppliers/:id ─────────────────────────────────────────────────────
async function updateSupplier(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de proveedor inválido');
    }
    const allowed = ['name', 'location', 'email', 'phone', 'notes', 'isActive'];
    const updates = {};
    allowed.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    const s = await Supplier.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true });
    if (!s) return notFound(res, 'Proveedor no encontrado');
    return ok(res, mapSupplier(s));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── PATCH /api/suppliers/:id/deactivate ────────────────────────────────────────
async function deactivateSupplier(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de proveedor inválido');
    }
    const s = await Supplier.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: false } },
      { new: true }
    );
    if (!s) return notFound(res, 'Proveedor no encontrado');
    return ok(res, { message: 'Proveedor desactivado', id: s._id });
  } catch (error) {
    return serverError(res, error);
  }
}

module.exports = {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deactivateSupplier,
};
