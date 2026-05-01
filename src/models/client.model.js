const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    company: {
      type: String,
      trim: true,
    },
    // RUT canónico: "12345678-9" (sin puntos, K en mayúscula).
    // La validación y normalización se hace en el controller con validators.js.
    // Índice único sparse: permite múltiples docs con rut=null (B2B sin RUT
    // todavía), pero no duplicados cuando sí está definido.
    rut: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      index: { unique: true, sparse: true },
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null = se auto-registró desde el portal público
    },

    // ── Vínculo con cuenta de portal ──────────────────────────────────────────
    // Si está presente, este Client tiene una cuenta User[CLIENTE] que puede
    // hacer login al portal. Si es null, es un cliente solo-CRM (sin acceso).
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Índice compuesto para búsqueda rápida por nombre y empresa
clientSchema.index({ name: 'text', company: 'text', rut: 'text' });

module.exports = mongoose.model('Client', clientSchema);
