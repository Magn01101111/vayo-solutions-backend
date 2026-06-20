const express = require('express');
const rateLimit = require('express-rate-limit');
const { detect } = require('../controllers/ml.controller');

const router = express.Router();

const mlRateLimit = rateLimit({
  windowMs: 60 * 1_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Demasiadas solicitudes al escáner. Espera un momento.' },
});

// POST /api/ml/detect — proxy hacia GCR CNN
// Público (sin auth): el escáner funciona para usuarios invitados.
router.post('/detect', mlRateLimit, detect);

module.exports = router;
