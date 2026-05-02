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
    // URL pública de Cloudinary (lo que se muestra al usuario)
    imageUrl: {
      type: String,
      trim: true,
    },
    // public_id de Cloudinary — necesario para borrar el asset cuando se reemplaza
    imagePublicId: {
      type: String,
      trim: true,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
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

// Índices para búsqueda optimizada (HU 04-2026-024)
productSchema.index({ name: 'text', sku: 'text', brand: 'text', model: 'text' });
productSchema.index({ isActive: 1, category: 1 });

module.exports = mongoose.model('Product', productSchema);