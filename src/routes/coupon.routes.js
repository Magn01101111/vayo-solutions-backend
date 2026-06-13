const express = require('express');
const {
  getCoupons,
  validateCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} = require('../controllers/coupon.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// Público: validar un cupón al aplicarlo en el carrito.
router.post('/validate', validateCoupon);

// Admin: gestión de cupones.
router.get('/', verifyToken, requireRole(ROLES.ADMIN), getCoupons);
router.post('/', verifyToken, requireRole(ROLES.ADMIN), createCoupon);
router.put('/:id', verifyToken, requireRole(ROLES.ADMIN), updateCoupon);
router.delete('/:id', verifyToken, requireRole(ROLES.ADMIN), deleteCoupon);

module.exports = router;
