const express = require('express');
const {
  createQuote,
  getQuotes,
  getQuoteById,
  getQuoteByFolio,
  downloadQuotePDF,
} = require('../controllers/quote.controller');
const { verifyToken, optionalAuth } = require('../middlewares/auth.middleware');

const router = express.Router();

// Crear cotización — público (cualquiera puede generar una)
// Si el usuario está autenticado como CLIENTE, se asocia automáticamente.
router.post('/', optionalAuth, createQuote);

// Listar — requiere auth (los CLIENTE solo ven las suyas)
router.get('/', verifyToken, getQuotes);

// Búsqueda por folio (orden importa: específica antes que :id)
router.get('/folio/:folio', verifyToken, getQuoteByFolio);

// Detalle por ID
router.get('/:id', verifyToken, getQuoteById);

// PDF
router.get('/:id/pdf', verifyToken, downloadQuotePDF);

module.exports = router;
