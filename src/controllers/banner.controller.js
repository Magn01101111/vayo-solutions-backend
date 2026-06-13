const mongoose = require('mongoose');
const Banner = require('../models/banner.model');
const { uploadBuffer, deleteAsset } = require('../services/cloudinary.service');
const {
  ok,
  created,
  fail,
  notFound,
  serverError,
} = require('../utils/response');

function mapBanner(b) {
  return {
    id: b._id,
    title: b.title,
    subtitle: b.subtitle,
    imageUrl: b.imageUrl,
    imagePublicId: b.imagePublicId,
    link: b.link,
    order: b.order,
    isActive: b.isActive,
    createdAt: b.createdAt,
  };
}

// ── GET /api/banners ───────────────────────────────────────────────────────────
// Público: solo activos. ?all=true (ADMIN) incluye inactivos.
async function getBanners(req, res) {
  try {
    const wantsAll = req.query.all === 'true' && req.user?.role === 'ADMIN';
    const filter = wantsAll ? {} : { isActive: true };
    const banners = await Banner.find(filter).sort({ order: 1, createdAt: -1 });
    return ok(res, banners.map(mapBanner));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── POST /api/banners ──────────────────────────────────────────────────────────
async function createBanner(req, res) {
  try {
    const { title, subtitle, imageUrl, imagePublicId, link, order } = req.body;
    if (!imageUrl) return fail(res, 'La imagen es requerida');

    const banner = await Banner.create({
      title: title || '',
      subtitle: subtitle || '',
      imageUrl,
      imagePublicId: imagePublicId || null,
      link: link || '',
      order: Number(order) || 0,
    });
    return created(res, mapBanner(banner));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── PUT /api/banners/:id ───────────────────────────────────────────────────────
async function updateBanner(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de banner inválido');
    }
    const banner = await Banner.findById(req.params.id);
    if (!banner) return notFound(res, 'Banner no encontrado');

    const oldPublicId = banner.imagePublicId;

    const allowed = ['title', 'subtitle', 'imageUrl', 'imagePublicId', 'link', 'order', 'isActive'];
    allowed.forEach((f) => { if (req.body[f] !== undefined) banner[f] = req.body[f]; });

    await banner.save();

    // Si cambió la imagen, limpiar la anterior de Cloudinary.
    if (req.body.imagePublicId !== undefined && oldPublicId && oldPublicId !== req.body.imagePublicId) {
      deleteAsset(oldPublicId);
    }

    return ok(res, mapBanner(banner));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── DELETE /api/banners/:id ────────────────────────────────────────────────────
async function deleteBanner(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de banner inválido');
    }
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) return notFound(res, 'Banner no encontrado');
    if (banner.imagePublicId) deleteAsset(banner.imagePublicId);
    return ok(res, { message: 'Banner eliminado', id: banner._id });
  } catch (error) {
    return serverError(res, error);
  }
}

module.exports = { getBanners, createBanner, updateBanner, deleteBanner };
