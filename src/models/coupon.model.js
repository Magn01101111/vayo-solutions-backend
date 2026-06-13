const mongoose = require('mongoose');

/**
 * Cupón de descuento gestionable desde el panel admin.
 *
 * Tipos:
 *   - percentage: descuenta un % del subtotal (value = 0-100)
 *   - fixed:      descuenta un monto fijo en CLP (value = monto)
 *
 * Reglas de validez (se chequean al aplicar):
 *   - isActive: el admin puede pausarlo sin borrarlo
 *   - validUntil: fecha de expiración (null = sin expiración)
 *   - minSubtotal: monto mínimo de compra para aplicar
 *   - maxUses: límite total de usos (null = ilimitado); usedCount lleva la cuenta
 */
const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    minSubtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxUses: {
      type: Number,
      default: null, // null = ilimitado
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    validUntil: {
      type: Date,
      default: null, // null = sin expiración
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('Coupon', couponSchema);
