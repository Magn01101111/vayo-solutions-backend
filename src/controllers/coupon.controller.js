const mongoose = require('mongoose');
const Coupon = require('../models/coupon.model');
const {
  ok,
  created,
  fail,
  notFound,
  conflict,
  serverError,
} = require('../utils/response');

function mapCoupon(c) {
  return {
    id: c._id,
    code: c.code,
    type: c.type,
    value: c.value,
    description: c.description,
    minSubtotal: c.minSubtotal,
    maxUses: c.maxUses,
    usedCount: c.usedCount,
    validUntil: c.validUntil,
    isActive: c.isActive,
    createdAt: c.createdAt,
  };
}

/**
 * Evalúa si un cupón es aplicable a un subtotal dado.
 * Devuelve { valid, reason?, discount? }.
 * Reutilizable desde validate (público) y desde createQuote.
 */
function evaluateCoupon(coupon, subtotal) {
  if (!coupon) return { valid: false, reason: 'Cupón no encontrado' };
  if (!coupon.isActive) return { valid: false, reason: 'Cupón no disponible' };
  if (coupon.validUntil && new Date() > coupon.validUntil) {
    return { valid: false, reason: 'Cupón expirado' };
  }
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, reason: 'Cupón agotado' };
  }
  if (coupon.minSubtotal && subtotal < coupon.minSubtotal) {
    return {
      valid: false,
      reason: `Requiere un subtotal mínimo de $${coupon.minSubtotal.toLocaleString('es-CL')}`,
    };
  }

  const discount =
    coupon.type === 'percentage'
      ? Math.round((subtotal * coupon.value) / 100)
      : Math.min(coupon.value, subtotal);

  return { valid: true, discount };
}

// ── GET /api/coupons ───────────────────────────────────────────────────────────
// ADMIN: lista todos. ?all=true incluye inactivos.
async function getCoupons(req, res) {
  try {
    const filter = req.query.all === 'true' ? {} : { isActive: true };
    const coupons = await Coupon.find(filter).sort({ createdAt: -1 });
    return ok(res, coupons.map(mapCoupon));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── POST /api/coupons/validate ─────────────────────────────────────────────────
// Público: valida un código contra un subtotal. Body: { code, subtotal }
async function validateCoupon(req, res) {
  try {
    const code = (req.body.code || '').toUpperCase().trim();
    const subtotal = Number(req.body.subtotal) || 0;
    if (!code) return fail(res, 'Ingresa un código');

    const coupon = await Coupon.findOne({ code });
    const result = evaluateCoupon(coupon, subtotal);

    if (!result.valid) return fail(res, result.reason);

    return ok(res, {
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      description: coupon.description,
      discount: result.discount,
    });
  } catch (error) {
    return serverError(res, error);
  }
}

// ── POST /api/coupons ──────────────────────────────────────────────────────────
async function createCoupon(req, res) {
  try {
    const { code, type, value, description, minSubtotal, maxUses, validUntil } = req.body;
    if (!code || !code.trim()) return fail(res, 'El código es requerido');
    if (!['percentage', 'fixed'].includes(type)) return fail(res, 'Tipo inválido');
    if (value == null || Number(value) < 0) return fail(res, 'Valor inválido');
    if (type === 'percentage' && Number(value) > 100) return fail(res, 'El porcentaje no puede superar 100');

    const normalizedCode = code.toUpperCase().trim();
    const exists = await Coupon.findOne({ code: normalizedCode });
    if (exists) return conflict(res, 'Ya existe un cupón con ese código');

    const coupon = await Coupon.create({
      code: normalizedCode,
      type,
      value: Number(value),
      description: description || '',
      minSubtotal: Number(minSubtotal) || 0,
      maxUses: maxUses != null && maxUses !== '' ? Number(maxUses) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
    });
    return created(res, mapCoupon(coupon));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── PUT /api/coupons/:id ───────────────────────────────────────────────────────
async function updateCoupon(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de cupón inválido');
    }
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) return notFound(res, 'Cupón no encontrado');

    const { type, value, description, minSubtotal, maxUses, validUntil, isActive } = req.body;
    if (type !== undefined) coupon.type = type;
    if (value !== undefined) coupon.value = Number(value);
    if (description !== undefined) coupon.description = description;
    if (minSubtotal !== undefined) coupon.minSubtotal = Number(minSubtotal) || 0;
    if (maxUses !== undefined) coupon.maxUses = maxUses === '' || maxUses == null ? null : Number(maxUses);
    if (validUntil !== undefined) coupon.validUntil = validUntil ? new Date(validUntil) : null;
    if (isActive !== undefined) coupon.isActive = isActive;

    await coupon.save();
    return ok(res, mapCoupon(coupon));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── DELETE /api/coupons/:id ────────────────────────────────────────────────────
async function deleteCoupon(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de cupón inválido');
    }
    const coupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!coupon) return notFound(res, 'Cupón no encontrado');
    return ok(res, { message: 'Cupón eliminado', id: coupon._id });
  } catch (error) {
    return serverError(res, error);
  }
}

module.exports = {
  getCoupons,
  validateCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  // helpers reutilizables
  evaluateCoupon,
  mapCoupon,
};
