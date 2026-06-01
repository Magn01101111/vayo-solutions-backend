const express = require('express');
const { getDashboardStats } = require('../controllers/stats.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// Estadísticas del panel — ADMIN y COTIZADOR
router.get(
  '/dashboard',
  verifyToken,
  requireRole(ROLES.ADMIN, ROLES.COTIZADOR),
  getDashboardStats
);

module.exports = router;
