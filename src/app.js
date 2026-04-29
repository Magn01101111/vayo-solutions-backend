const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');

const app = express();

// ── Seguridad ──────────────────────────────────────────────────────────────────
app.use(
  helmet({
    // Permitir imágenes servidas localmente en el mismo origen
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// ── CORS ───────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ── Logging HTTP (solo en desarrollo) ─────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ── Body parsers ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Archivos estáticos (imágenes subidas) ─────────────────────────────────────
app.use(
  '/uploads',
  express.static(
    path.join(process.cwd(), process.env.UPLOAD_PATH || 'uploads')
  )
);

// ── Rutas API ──────────────────────────────────────────────────────────────────
app.use(routes);

// ── 404 genérico ───────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'Ruta no encontrada' });
});

// ── Manejo global de errores ───────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[unhandled error]', err);
  res.status(500).json({
    ok: false,
    error: err.message || 'Error interno del servidor',
  });
});

module.exports = app;
