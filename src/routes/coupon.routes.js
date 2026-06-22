const express = require('express');
const {
  getCoupons,
  getMyCoupons,
  validateCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} = require('../controllers/coupon.controller');
const {
  verifyToken,
  requireRole,
  optionalAuth,
} = require('../middlewares/auth.middleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// Público (auth opcional para cupones con dueño): validar un cupón al aplicarlo.
router.post('/validate', optionalAuth, validateCoupon);

// Cliente autenticado: sus propios cupones vigentes.
router.get('/mine', verifyToken, getMyCoupons);

// Admin: gestión de cupones.
router.get('/', verifyToken, requireRole(ROLES.ADMIN), getCoupons);
router.post('/', verifyToken, requireRole(ROLES.ADMIN), createCoupon);
router.put('/:id', verifyToken, requireRole(ROLES.ADMIN), updateCoupon);
router.delete('/:id', verifyToken, requireRole(ROLES.ADMIN), deleteCoupon);

module.exports = router;
