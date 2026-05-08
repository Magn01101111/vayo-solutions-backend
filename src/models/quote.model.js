const mongoose = require('mongoose');

// ── Sub-schema reutilizable para direcciones ─────────────────────────────────
const addressSchema = new mongoose.Schema(
  {
    street: { type: String, default: '' },
    number: { type: String, default: '' },
    apt: { type: String, default: '' },
    city: { type: String, default: '' },
    region: { type: String, default: '' },
    zip: { type: String, default: '' },
    reference: { type: String, default: '' },
  },
  { _id: false }
);

const quoteSchema = new mongoose.Schema(
  {
    /**
     * Folio público único, generado en formato "Q-2026-0001".
     * Se genera automáticamente en el pre-validate hook (ver abajo).
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

    // ── Snapshot de datos del cliente al momento de la cotización ────────────
    client: {
      customerType: {
        type: String,
        enum: ['person', 'company'],
        default: 'person',
      },
      name: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      company: { type: String, default: '' },
      taxId: { type: String, default: '' }, // RUT
      businessActivity: { type: String, default: '' }, // Giro
      notes: { type: String, default: '' },
    },

    // ── Direcciones ──────────────────────────────────────────────────────────
    billingAddress: { type: addressSchema, default: () => ({}) },
    shippingAddress: { type: addressSchema, default: () => ({}) },
    shippingSameAsBilling: { type: Boolean, default: true },

    // ── Ítems ────────────────────────────────────────────────────────────────
    items: [
      {
        productId: { type: String },
        name: { type: String },
        sku: { type: String, default: '' },
        price: { type: Number, default: 0 },
        quantity: { type: Number, default: 1 },
        total: { type: Number, default: 0 },
        notes: { type: String, default: '' }, // Nota por ítem
      },
    ],

    // ── Cupón aplicado ───────────────────────────────────────────────────────
    coupon: {
      code: { type: String, default: '' },
      type: { type: String, enum: ['percentage', 'fixed', ''], default: '' },
      value: { type: Number, default: 0 },
      description: { type: String, default: '' },
    },

    // ── Envío ────────────────────────────────────────────────────────────────
    shipping: {
      methodId: { type: String, default: 'pickup' },
      methodLabel: { type: String, default: 'Retiro en tienda' },
      estimatedDays: { type: String, default: '' },
      cost: { type: Number, default: 0 },
    },

    // ── Totales ──────────────────────────────────────────────────────────────
    totals: {
      subtotal: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      taxableBase: { type: Number, default: 0 },
      iva: { type: Number, default: 0 },
      shipping: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },

    // ── Términos comerciales ─────────────────────────────────────────────────
    currency: {
      type: String,
      enum: ['CLP', 'USD', 'UF'],
      default: 'CLP',
    },
    paymentTerms: {
      type: String,
      enum: ['contado', '15-dias', '30-dias', '60-dias'],
      default: 'contado',
    },
    deliveryTerms: {
      type: String,
      enum: ['pickup', 'delivery', 'shipping'],
      default: 'pickup',
    },
    validityDays: { type: Number, default: 30 },
    validUntil: { type: Date, default: null },

    // ── Observaciones / aceptaciones ─────────────────────────────────────────
    generalNotes: { type: String, default: '' },
    acceptsTerms: { type: Boolean, default: false },
    acceptsMarketing: { type: Boolean, default: false },

    // ── Metadata ─────────────────────────────────────────────────────────────
    metadata: {
      status: {
        type: String,
        enum: ['sent', 'accepted', 'rejected', 'expired'],
        default: 'sent',
      },
      createdAt: { type: String, default: () => new Date().toISOString() },
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

// ── Auto-completar validUntil si no viene ─────────────────────────────────────
quoteSchema.pre('save', function (next) {
  if (!this.validUntil) {
    const days = this.validityDays || 30;
    const d = new Date();
    d.setDate(d.getDate() + days);
    this.validUntil = d;
  }
  next();
});

module.exports = mongoose.model('Quote', quoteSchema);