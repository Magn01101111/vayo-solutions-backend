const mongoose = require('mongoose');

/**
 * Proveedor / distribuidor comercial.
 *
 * OJO: es distinto del rol de usuario PROVEEDOR (que es una cuenta de login).
 * Este `Supplier` es una entidad de catálogo: empresas que abastecen los
 * repuestos. Se administran globalmente y luego se ASIGNAN a cada producto
 * con su tiempo de entrega específico (ver product.model.js → suppliers[]).
 */
const supplierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('Supplier', supplierSchema);
