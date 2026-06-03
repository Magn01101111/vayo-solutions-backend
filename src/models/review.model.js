const mongoose = require('mongoose');

/**
 * Reseña de un producto, escrita por un CLIENTE autenticado.
 *
 * Flujo:
 *   1. El cliente logueado deja una reseña en la ficha del producto.
 *   2. Queda en estado 'pending' (pendiente de moderación).
 *   3. El admin la aprueba ('approved') o la rechaza ('rejected').
 *   4. Solo las 'approved' se muestran públicamente.
 *
 * `verified` indica "compra verificada": true si el cliente realmente compró
 * el producto (se calcula al crear, buscando una venta suya con ese producto).
 */
const reviewSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },

    // Autor (cuenta de usuario CLIENTE)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      default: null,
    },

    // Snapshot del autor (para mostrar sin populate)
    authorName: { type: String, required: true, trim: true },
    authorCompany: { type: String, trim: true, default: '' },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    tags: {
      type: [String],
      default: [],
    },

    /** Compra verificada: el autor compró este producto. */
    verified: {
      type: Boolean,
      default: false,
    },

    /** Estado de moderación. */
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true, versionKey: false }
);

// Un cliente solo puede dejar UNA reseña por producto.
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Review', reviewSchema);
