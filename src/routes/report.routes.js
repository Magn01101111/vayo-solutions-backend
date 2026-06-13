const express = require('express');
const {
  reportSales,
  reportQuotes,
  reportClients,
  reportMostQuotedProducts,
} = require('../controllers/report.controller');
const { verifyToken, requireRole } = require('../middlewares/auth.middleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

// Todos los reportes: solo ADMIN y COTIZADOR
router.use(verifyToken, requireRole(ROLES.ADMIN, ROLES.COTIZADOR));

router.get('/sales', reportSales);
router.get('/quotes', reportQuotes);
router.get('/clients', reportClients);
router.get('/products-most-quoted', reportMostQuotedProducts);

module.exports = router;
