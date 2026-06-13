const express = require('express');
const {
  createQuote,
  getQuotes,
  getQuoteById,
  getQuoteByFolio,
  updateQuoteStatus,
  markQuoteViewed,
  sendQuoteByEmail,
  downloadQuotePDF,
  duplicateQuote,
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

// Marcar como vista por el cliente (primera apertura)
router.patch('/:id/mark-viewed', verifyToken, markQuoteViewed);

// Enviar por email (con PDF adjunto) — usuario autenticado
router.post('/:id/send-email', verifyToken, sendQuoteByEmail);

// PDF
router.get('/:id/pdf', optionalAuth, downloadQuotePDF);

// Duplicar cotización
router.post('/:id/duplicate', verifyToken, duplicateQuote);

module.exports = router;
