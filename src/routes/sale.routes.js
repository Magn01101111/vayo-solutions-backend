const express = require('express');
const {
  getSales,
  getSaleById,
  createSaleFromQuote,
  updateSaleStatus,
} = require('../controllers/sale.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// Lectura: ADMIN y COTIZADOR
router.get('/', verifyToken, requireRole(ROLES.ADMIN, ROLES.COTIZADOR), getSales);
router.get('/:id', verifyToken, requireRole(ROLES.ADMIN, ROLES.COTIZADOR), getSaleById);

// Conversión cotización → venta: ADMIN y COTIZADOR
router.post(
  '/from-quote/:quoteId',
  verifyToken,
  requireRole(ROLES.ADMIN, ROLES.COTIZADOR),
  createSaleFromQuote
);

// Cambio de estado: ADMIN y COTIZADOR
router.patch(
  '/:id/status',
  verifyToken,
  requireRole(ROLES.ADMIN, ROLES.COTIZADOR),
  updateSaleStatus
);

module.exports = router;
