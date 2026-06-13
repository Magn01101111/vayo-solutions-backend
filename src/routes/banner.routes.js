const express = require('express');
const {
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
} = require('../controllers/banner.controller');
const { verifyToken, requireRole, optionalAuth } = require('../middlewares/auth.middleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// Público: banners activos para el home.
router.get('/', optionalAuth, getBanners);

// Admin: gestión.
router.post('/', verifyToken, requireRole(ROLES.ADMIN), createBanner);
router.put('/:id', verifyToken, requireRole(ROLES.ADMIN), updateBanner);
router.delete('/:id', verifyToken, requireRole(ROLES.ADMIN), deleteBanner);

module.exports = router;
