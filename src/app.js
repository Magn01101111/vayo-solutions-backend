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
// Soporta múltiples orígenes separados por coma en FRONTEND_URL
const ALLOWED_ORIGINS = (process.env.FRONTEND_URL || 'http://localhost:4200')
  .split(',')
  .map((s) => s.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir peticiones sin origin (curl, Postman, SSR)
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes('*') || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
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
