const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const routes = require('./routes');

const app = express();

// ── Seguridad ──────────────────────────────────────────────────────────────────
app.use(
  helmet({
    // Permitir imágenes servidas localmente en el mismo origen
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// ── Rate limiting ───────────────────────────────────────────────────────────────
// Límite global generoso: la app es una SPA autenticada y varias personas de una
// misma oficina pueden compartir IP (NAT), por lo que 100/15min era demasiado bajo.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' },
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Demasiados intentos de autenticación. Espera un minuto.' },
});

// Anti-spam SOLO en la creación de cotizaciones (POST). Los GET de /api/quotes
// (admin revisando, portal del cliente cargando su historial) NO deben limitarse
// aquí — quedan cubiertos por el límite global.
const quoteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method !== 'POST',
  message: { ok: false, error: 'Demasiadas cotizaciones. Espera un minuto.' },
});

app.use(globalLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/quotes', quoteLimiter);

// ── CORS ───────────────────────────────────────────────────────────────────────
// Reglas de origen aceptado:
//   1. Cualquier origen listado en FRONTEND_URL (separado por comas)
//   2. Cualquier subdominio de *.netlify.app (incluye preview deploys)
//   3. Cualquier subdominio de *.onrender.com (testing)
// Esto permite que producción, staging y previews funcionen sin redeploy.
const FRONTEND_URLS = (process.env.FRONTEND_URL || 'http://localhost:4200')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const ALLOWED_HOST_PATTERNS = [
  /\.netlify\.app$/,   // *.netlify.app
  /\.onrender\.com$/,  // *.onrender.com
];

function isOriginAllowed(origin) {
  if (FRONTEND_URLS.includes('*') || FRONTEND_URLS.includes(origin)) return true;
  try {
    const { hostname } = new URL(origin);
    return ALLOWED_HOST_PATTERNS.some((re) => re.test(hostname));
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir peticiones sin origin (curl, Postman, SSR)
      if (!origin) return callback(null, true);
      if (isOriginAllowed(origin)) return callback(null, true);
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
/* app.use(
  '/uploads',
  express.static(
    path.join(process.cwd(), process.env.UPLOAD_PATH || 'uploads')
  )
); */



// ── Rutas API ──────────────────────────────────────────────────────────────────
// Nota: /api/upload se monta dentro de routes/index.js junto con el resto
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
