const mongoose = require('mongoose');

const productSpecSchema = new mongoose.Schema(
  {
    key: { type: String, trim: true },
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const productDocumentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['pdf', 'doc', 'image', 'other'],
      required: true,
    },
    sizeMb: { type: Number, min: 0 },
    provider: { type: String, trim: true },
    url: { type: String, trim: true },
  },
  { _id: false }
);

const productDimensionsSchema = new mongoose.Schema(
  {
    heightMm: Number,
    widthMm: Number,
    lengthMm: Number,
    diameterMm: Number,
    netWeightKg: Number,
    grossWeightKg: Number,
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    brand: {
      type: String,
      required: true,
      trim: true,
    },
    model: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      default: null,
      min: 0,
    },
    currency: {
      type: String,
      enum: ['CLP'],
      default: 'CLP',
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    availabilityStatus: {
      type: String,
      enum: ['in_stock', 'out_of_stock', 'on_request', 'discontinued'],
      required: true,
      default: 'out_of_stock',
    },
    /**
     * Galería de imágenes del producto (máx 4).
     * El elemento [0] es la imagen principal — la que se ve en cards de catálogo.
     * El resto se muestra en la ficha de detalle del producto.
     */
    images: {
      type: [
        {
          _id: false,
          url: { type: String, required: true, trim: true },
          publicId: { type: String, trim: true, default: null },
        },
      ],
      default: [],
      validate: {
        validator: (arr) => !arr || arr.length <= 4,
        message: 'Un producto puede tener hasta 4 imágenes',
      },
    },

    // ── Campos legacy (mantenidos por compatibilidad con catálogo/home) ──────
    // Siempre quedan en sync con images[0] vía pre-save hook.
    imageUrl: {
      type: String,
      trim: true,
    },
    imagePublicId: {
      type: String,
      trim: true,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Producto destacado: aparece en la portada/home de ofertas.
    // El admin lo marca manualmente. Campo opcional (default false), por lo que
    // los productos existentes NO requieren migración.
    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    specs: {
      type: [productSpecSchema],
      default: [],
    },
    dimensions: {
      type: productDimensionsSchema,
      default: () => ({}),
    },
    compatibility: {
      type: [String],
      default: [],
    },
    documents: {
      type: [productDocumentSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// ── Hook: mantener imageUrl/imagePublicId sincronizados con images[0] ────────
// Esto asegura backwards-compatibility: el catálogo y home siguen leyendo
// imageUrl directamente, sin tener que conocer el array images[].
productSchema.pre('save', function () {
  if (Array.isArray(this.images) && this.images.length > 0) {
    this.imageUrl      = this.images[0].url;
    this.imagePublicId = this.images[0].publicId ?? null;
  } else if (this.imageUrl) {
    // Migración inversa: si vino solo el campo legacy, lo subimos a images[0]
    this.images = [{ url: this.imageUrl, publicId: this.imagePublicId ?? null }];
  } else {
    this.imageUrl      = null;
    this.imagePublicId = null;
  }
});

// Índices para búsqueda optimizada (HU 04-2026-024)
productSchema.index({ name: 'text', sku: 'text', brand: 'text', model: 'text' });
productSchema.index({ isActive: 1, category: 1 });

module.exports = mongoose.model('Product', productSchema);