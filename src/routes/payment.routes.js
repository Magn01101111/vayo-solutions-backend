const express = require('express');
const router  = express.Router();

const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { ROLES }                    = require('../constants/roles');
const {
  initWebpay,
  returnWebpay,
  statusWebpay,
  getPaymentsBySale,
  refundWebpay,
} = require('../controllers/payment.controller');

// Iniciar pago Webpay para una venta (cualquier usuario autenticado con acceso a ventas)
router.post(
  '/webpay/init',
  verifyToken,
  requireRole(ROLES.ADMIN, ROLES.COTIZADOR, ROLES.CLIENTE),
  initWebpay,
);

// Return URL de Webpay — sin auth (el browser del usuario hace el POST, no nuestra app)
router.post('/webpay/return', returnWebpay);

// Consulta de estado de un token (debug, solo ADMIN)
router.get(
  '/webpay/status/:token',
  verifyToken,
  requireRole(ROLES.ADMIN),
  statusWebpay,
);

// Historial de pagos de una venta (ADMIN / COTIZADOR)
router.get(
  '/sale/:saleId',
  verifyToken,
  requireRole(ROLES.ADMIN, ROLES.COTIZADOR),
  getPaymentsBySale,
);

// Anular pago autorizado (solo ADMIN)
router.post(
  '/webpay/refund/:paymentId',
  verifyToken,
  requireRole(ROLES.ADMIN),
  refundWebpay,
);

module.exports = router;
