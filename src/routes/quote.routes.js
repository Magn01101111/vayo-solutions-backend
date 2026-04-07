const express = require('express');
const {
  createQuote,
  getQuotes,
  getQuoteById,
  downloadQuotePDF,
} = require('../controllers/quote.controller');

const router = express.Router();

// Crear cotización
router.post('/', createQuote);

// (opcional pero recomendado)
router.get('/', getQuotes);
router.get('/:id', getQuoteById);
router.get('/:id/pdf', downloadQuotePDF);

module.exports = router;