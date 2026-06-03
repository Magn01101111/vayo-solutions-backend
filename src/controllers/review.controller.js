const mongoose = require('mongoose');
const Review = require('../models/review.model');
const Sale = require('../models/sale.model');
const User = require('../models/user.model');
const { ROLES } = require('../constants/roles');
const {
  ok,
  created,
  fail,
  notFound,
  conflict,
  serverError,
} = require('../utils/response');

function mapReview(r) {
  return {
    id: r._id,
    productId: r.productId,
    authorName: r.authorName,
    authorCompany: r.authorCompany,
    rating: r.rating,
    body: r.body,
    tags: r.tags ?? [],
    verified: r.verified,
    status: r.status,
    createdAt: r.createdAt,
  };
}

/** Resumen (promedio + conteo) de reseñas aprobadas de un producto. */
async function buildSummary(productId) {
  const approved = await Review.find({ productId, status: 'approved' })
    .select('rating')
    .lean();
  const count = approved.length;
  const avg = count > 0
    ? Math.round((approved.reduce((a, r) => a + r.rating, 0) / count) * 10) / 10
    : 0;
  return { count, average: avg };
}

// ── GET /api/reviews/product/:productId ───────────────────────────────────────
// Público: devuelve reseñas APROBADAS + resumen.
async function getProductReviews(req, res) {
  try {
    const { productId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return fail(res, 'ID de producto inválido');
    }

    const reviews = await Review.find({ productId, status: 'approved' })
      .sort({ createdAt: -1 })
      .lean();
    const summary = await buildSummary(productId);

    return ok(res, { summary, reviews: reviews.map(mapReview) });
  } catch (error) {
    return serverError(res, error);
  }
}

// ── POST /api/reviews/product/:productId ──────────────────────────────────────
// CLIENTE autenticado deja una reseña (queda 'pending').
async function createReview(req, res) {
  try {
    const { productId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return fail(res, 'ID de producto inválido');
    }

    const { rating, body, tags } = req.body;
    const numRating = Number(rating);
    if (!numRating || numRating < 1 || numRating > 5) {
      return fail(res, 'La calificación debe ser entre 1 y 5');
    }
    if (!body || !body.trim()) {
      return fail(res, 'El comentario es requerido');
    }

    // Evitar doble reseña del mismo usuario sobre el mismo producto
    const existing = await Review.findOne({ productId, userId: req.user.id });
    if (existing) {
      return conflict(res, 'Ya dejaste una reseña para este producto');
    }

    // Datos del autor
    const user = await User.findById(req.user.id).lean();
    const authorName = user?.name || 'Cliente';

    // "Compra verificada": ¿el cliente tiene una venta con este producto?
    let verified = false;
    if (req.user.clientId) {
      const sale = await Sale.findOne({
        clientId: req.user.clientId,
        'items.productId': String(productId),
      }).select('_id').lean();
      verified = !!sale;
    }

    const review = await Review.create({
      productId,
      userId: req.user.id,
      clientId: req.user.clientId ?? null,
      authorName,
      authorCompany: req.body.authorCompany || '',
      rating: numRating,
      body: body.trim(),
      tags: Array.isArray(tags) ? tags.slice(0, 5) : [],
      verified,
      status: 'pending',
    });

    return created(res, {
      message: 'Reseña enviada. Será visible tras la aprobación del equipo.',
      review: mapReview(review),
    });
  } catch (error) {
    if (error.code === 11000) {
      return conflict(res, 'Ya dejaste una reseña para este producto');
    }
    return serverError(res, error);
  }
}

// ── GET /api/reviews ──────────────────────────────────────────────────────────
// ADMIN: lista todas (con filtro ?status=).
async function getAllReviews(req, res) {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    const reviews = await Review.find(filter)
      .sort({ createdAt: -1 })
      .populate('productId', 'name sku')
      .lean();
    return ok(res, reviews.map((r) => ({
      ...mapReview(r),
      product: r.productId && typeof r.productId === 'object'
        ? { id: r.productId._id, name: r.productId.name, sku: r.productId.sku }
        : null,
    })));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── PATCH /api/reviews/:id/status ─────────────────────────────────────────────
// ADMIN modera: approved | rejected | pending.
async function moderateReview(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de reseña inválido');
    }
    const { status } = req.body;
    const allowed = ['pending', 'approved', 'rejected'];
    if (!allowed.includes(status)) {
      return fail(res, `Estado inválido. Use: ${allowed.join(', ')}`);
    }
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true }
    );
    if (!review) return notFound(res, 'Reseña no encontrada');
    return ok(res, mapReview(review));
  } catch (error) {
    return serverError(res, error);
  }
}

// ── DELETE /api/reviews/:id ───────────────────────────────────────────────────
async function deleteReview(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return fail(res, 'ID de reseña inválido');
    }
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return notFound(res, 'Reseña no encontrada');
    return ok(res, { message: 'Reseña eliminada', id: review._id });
  } catch (error) {
    return serverError(res, error);
  }
}

module.exports = {
  getProductReviews,
  createReview,
  getAllReviews,
  moderateReview,
  deleteReview,
};
