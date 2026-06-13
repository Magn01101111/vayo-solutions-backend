const express = require('express');
const {
  createQuote,
  getQuotes,
  getQuoteById,
  getQuoteByFolio,
  updateQuoteStatus,
  sendQuoteByEmail,
  downloadQuotePDF,
} = require('../controllers/quote.controller');
const { verifyToken, optionalAuth, requireRole } = require('../middlewares/auth.middleware');
const { ROLES } = require('../constants/roles');

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

// Cambiar estado — control de roles en el controller
router.patch('/:id/status', verifyToken, updateQuoteStatus);

// Enviar por email (con PDF adjunto) — usuario autenticado
router.post('/:id/send-email', verifyToken, sendQuoteByEmail);

// PDF
router.get('/:id/pdf', optionalAuth, downloadQuotePDF);

module.exports = router;
