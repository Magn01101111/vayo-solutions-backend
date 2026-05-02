const mongoose = require('mongoose');

const quoteSchema = new mongoose.Schema(
  {
    /**
     * Folio público único, generado en formato "Q-2026-0001".
     * Se genera automáticamente en el pre-save hook (ver abajo).
     */
    folio: {
      type: String,
      unique: true,
      index: true,
    },

    /**
     * Referencia opcional al Client CRM al que pertenece la cotización.
     * Se completa cuando la cotización se asocia a un cliente existente
     * (ej. desde el portal autenticado, o cuando un cotizador la registra
     * a nombre de un Client del CRM).
     */
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      default: null,
      index: true,
    },

    // Snapshot de datos del cliente al momento de la cotización
    client: {
      name: String,
      email: String,
      phone: String,
    },

    items: [
      {
        productId: String,
        name: String,
        price: Number,
        quantity: Number,
        total: Number,
      },
    ],

    totals: {
      subtotal: Number,
      iva: Number,
      total: Number,
    },

    metadata: {
      status: {
        type: String,
        enum: ['sent', 'accepted', 'rejected'],
        default: 'sent',
      },
      createdAt: String,
    },
  },
  {
    timestamps: true,
  }
);

// ── Auto-generación de folio ──────────────────────────────────────────────────
// Formato: Q-YYYY-NNNN (ej. "Q-2026-0001"). Se reinicia el contador por año.
quoteSchema.pre('validate', async function () {
  if (this.folio) return; // ya tiene folio (ej. al actualizar)

  const year = new Date().getFullYear();
  const prefix = `Q-${year}-`;

  // Buscar el último folio del año actual
  const last = await this.constructor
    .findOne({ folio: new RegExp(`^${prefix}`) })
    .sort({ folio: -1 })
    .select('folio')
    .lean();

  let nextNumber = 1;
  if (last && last.folio) {
    const match = last.folio.match(/-(\d+)$/);
    if (match) nextNumber = parseInt(match[1], 10) + 1;
  }

  this.folio = `${prefix}${String(nextNumber).padStart(4, '0')}`;
});

module.exports = mongoose.model('Quote', quoteSchema);
