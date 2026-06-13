const mongoose = require('mongoose');

/**
 * Banner promocional para el home público.
 * El admin sube una imagen (Cloudinary) + título/subtítulo opcional + enlace.
 * `order` controla el orden de aparición en el carrusel.
 */
const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    subtitle: { type: String, trim: true, default: '' },
    imageUrl: { type: String, required: true, trim: true },
    imagePublicId: { type: String, trim: true, default: null },
    /** A dónde lleva el banner al hacer click (ruta interna o URL). */
    link: { type: String, trim: true, default: '' },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false }
);

module.exports = mongoose.model('Banner', bannerSchema);
