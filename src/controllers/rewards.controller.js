const Coupon = require('../models/coupon.model');
const { ok, created, conflict, fail, serverError } = require('../utils/response');

// POST /api/rewards/claim
// CLIENTE autenticado. Genera un cupón 10% (válido 7 días, uso único).
// Anti-abuso: 1 reclamo por usuario por día (code embeds userId + fecha).
async function claimReward(req, res) {
  try {
    const userId  = req.user.id;
    const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const code    = `SCAN${userId.slice(-6).toUpperCase()}${dateTag}`;

    // Si ya existe el cupón de hoy → ya fue reclamado
    const existing = await Coupon.findOne({ code });
    if (existing) {
      return conflict(res, 'Ya reclamaste tu recompensa hoy. Vuelve mañana.');
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const coupon = await Coupon.create({
      code,
      type: 'percentage',
      value: 10,
      description: 'Cupón VAYO Escáner — 10% de descuento',
      maxUses: 1,
      validUntil: expiresAt,
      ownerUserId: userId, // atado a la cuenta → aparece en el wallet "Mis cupones"
      origin: 'scan',
      isActive: true,
    });

    return created(res, {
      code: coupon.code,
      value: coupon.value,
      type: coupon.type,
      description: coupon.description,
      expiresAt: coupon.validUntil,
    });
  } catch (error) {
    if (error.code === 11000) {
      return conflict(res, 'Ya reclamaste tu recompensa hoy. Vuelve mañana.');
    }
    return serverError(res, error);
  }
}

module.exports = { claimReward };
