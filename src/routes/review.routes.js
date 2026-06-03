const express = require('express');
const {
  getProductReviews,
  createReview,
  getAllReviews,
  moderateReview,
  deleteReview,
} = require('../controllers/review.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// ── Público ────────────────────────────────────────────────────────────────────
// Reseñas aprobadas de un producto.
router.get('/product/:productId', getProductReviews);

// ── Cliente autenticado ──────────────────────────────────────────────────────
// Crear reseña (queda pendiente de moderación).
router.post('/product/:productId', verifyToken, requireRole(ROLES.CLIENTE), createReview);

// ── Admin: moderación ─────────────────────────────────────────────────────────
router.get('/', verifyToken, requireRole(ROLES.ADMIN), getAllReviews);
router.patch('/:id/status', verifyToken, requireRole(ROLES.ADMIN), moderateReview);
router.delete('/:id', verifyToken, requireRole(ROLES.ADMIN), deleteReview);

module.exports = router;
