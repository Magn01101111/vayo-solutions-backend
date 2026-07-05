const mongoose = require('mongoose');

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

/**
 * Venta — se genera al convertir una cotización aceptada en venta.
 *
 * Toma un snapshot de los datos relevantes de la cotización al momento de la
 * conversión (cliente, items, totales) para preservar integridad histórica:
 * si la cotización o el cliente cambian después, la venta conserva lo que se
 * vendió realmente.
 */
const saleSchema = new mongoose.Schema(
  {
    /** Folio público único de la venta. Formato "V-2026-0001". */
    folio: {
      type: String,
      unique: true,
      index: true,
    },

    /** Cotización de origen (referencia). */
    quoteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quote',
      default: null,
      index: true,
    },
    /** Folio de la cotización de origen (snapshot, para mostrar sin populate). */
    quoteFolio: { type: String, default: '' },

    /** Cliente CRM asociado (referencia opcional). */
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      default: null,
      index: true,
    },

    /** Snapshot de datos del cliente al momento de la venta. */
    client: {
      name: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      company: { type: String, default: '' },
      taxId: { type: String, default: '' },
    },

    /** Snapshot de los ítems vendidos. */
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: { type: String },
        sku: { type: String, default: '' },
        price: { type: Number, default: 0 },
        quantity: { type: Number, default: 1 },
        total: { type: Number, default: 0 },
      },
    ],

    /** Snapshot del cupón aplicado (heredado de la cotización de origen). */
    coupon: {
      code: { type: String, default: '' },
      type: { type: String, default: '' },
      value: { type: Number, default: 0 },
      description: { type: String, default: '' },
    },

    manualDiscount: {
      amount: { type: Number, default: 0 },
      reason: { type: String, default: '' },
      appliedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      appliedAt: { type: Date, default: null },
    },

    billingAddress: { type: addressSchema, default: () => ({}) },
    shippingAddress: { type: addressSchema, default: () => ({}) },
    shippingSameAsBilling: { type: Boolean, default: true },

    shipping: {
      methodId: { type: String, default: 'pickup' },
      methodLabel: { type: String, default: 'Retiro en tienda' },
      estimatedDays: { type: String, default: '' },
      cost: { type: Number, default: 0 },
    },

    paymentTerms: {
      type: String,
      enum: ['contado', '15-dias', '30-dias', '60-dias', '90-dias'],
      default: 'contado',
    },

    deliveryTerms: {
      type: String,
      enum: ['pickup', 'delivery', 'shipping'],
      default: 'pickup',
    },

    /** Totales (snapshot). */
    totals: {
      subtotal: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      iva: { type: Number, default: 0 },
      shipping: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },

    currency: { type: String, enum: ['CLP', 'USD', 'UF'], default: 'CLP' },

    /** Método de pago (informativo en esta etapa; Webpay vendrá después). */
    paymentMethod: {
      type: String,
      enum: ['cash', 'transfer', 'card', 'credit', 'other'],
      default: 'transfer',
    },

    /** Estado de la venta. */
    status: {
      type: String,
      enum: ['pending', 'paid', 'cancelled'],
      default: 'pending',
      index: true,
    },

    /** Usuario (cotizador/admin) que registró la venta. */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// ── Auto-generación de folio: V-YYYY-NNNN ──────────────────────────────────────
saleSchema.pre('validate', async function () {
  if (this.folio) return;

  const year = new Date().getFullYear();
  const prefix = `V-${year}-`;

  const last = await this.constructor
    .findOne({ folio: new RegExp(`^${prefix}`) })
    .sort({ folio: -1 })
    .select('folio')
    .lean();

  let next = 1;
  if (last && last.folio) {
    const m = last.folio.match(/-(\d+)$/);
    if (m) next = parseInt(m[1], 10) + 1;
  }
  this.folio = `${prefix}${String(next).padStart(4, '0')}`;
});

module.exports = mongoose.model('Sale', saleSchema);
