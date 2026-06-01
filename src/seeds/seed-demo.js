/**
 * Seed de DEMO para el dashboard — Sprint 3
 *
 * Genera un volumen realista de datos para que el panel de control tenga sentido:
 *   - ~40 clientes CRM
 *   - ~130 cotizaciones (estados variados, distribuidas en 6 meses)
 *   - ~100 ventas (estados variados, distribuidas en 6 meses)
 *
 * Las fechas (createdAt) se distribuyen en los últimos 6 meses para que el
 * gráfico de "ventas por mes" y el resto de métricas se vean poblados.
 *
 * Reutiliza las categorías/productos/usuarios existentes (NO los borra). Si no
 * hay productos, primero corre `npm run seed`.
 *
 * Uso: npm run seed:demo
 *
 * ⚠️ Borra TODAS las cotizaciones y ventas existentes antes de generar las nuevas.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const User     = require('../models/user.model');
const Category = require('../models/category.model');
const Product  = require('../models/product.model');
const Client   = require('../models/client.model');
const Quote    = require('../models/quote.model');
const Sale     = require('../models/sale.model');
const { ROLES } = require('../constants/roles');

// ── Parámetros ───────────────────────────────────────────────────────────────
const N_CLIENTS = 40;
const N_QUOTES  = 130;
const N_SALES   = 100;
const MONTHS_BACK = 6;
const IVA_RATE  = 0.19;

// ── Datos base para generar nombres realistas ─────────────────────────────────
const FIRST_NAMES = ['Juan', 'María', 'Pedro', 'Camila', 'Diego', 'Valentina', 'José', 'Francisca', 'Andrés', 'Catalina', 'Felipe', 'Antonia', 'Sebastián', 'Javiera', 'Matías', 'Constanza', 'Cristóbal', 'Fernanda', 'Ignacio', 'Daniela'];
const LAST_NAMES  = ['González', 'Muñoz', 'Rojas', 'Díaz', 'Pérez', 'Soto', 'Contreras', 'Silva', 'Martínez', 'Sepúlveda', 'Morales', 'Rodríguez', 'López', 'Fuentes', 'Hernández', 'Torres', 'Araya', 'Flores', 'Espinoza', 'Castillo'];
const COMPANIES   = ['Climatiza SpA', 'Frío Industrial Ltda', 'TecnoHVAC', 'Ingeniería Térmica', 'Servicios Refrigeración Sur', 'DataCenter Cooling', 'AireTotal', 'Climas del Pacífico', 'Refrigeración Andina', 'HVAC Pro Chile', 'Termodinámica Ltda', 'Soluciones Climáticas', '', '', '']; // algunas vacías = persona natural
const CITIES      = ['Santiago', 'Valparaíso', 'Concepción', 'La Serena', 'Antofagasta', 'Temuco', 'Rancagua', 'Puerto Montt'];
const REGIONS     = ['Metropolitana', 'Valparaíso', 'Biobío', 'Coquimbo', 'Antofagasta', 'La Araucanía'];

// ── Helpers ────────────────────────────────────────────────────────────────────
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/** Fecha aleatoria dentro de los últimos N meses. */
function randomDateWithinMonths(months) {
  const now = Date.now();
  const past = now - months * 30 * 24 * 60 * 60 * 1000;
  return new Date(past + Math.random() * (now - past));
}

/** RUT chileno plausible y único (no valida DV — solo formato). */
let rutCounter = 9000000;
function nextRut() {
  rutCounter += randInt(1, 50);
  const dv = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'K'][rutCounter % 11];
  return `${rutCounter}-${dv}`;
}

/** Teléfono móvil chileno E.164. */
function randomPhone() {
  return `+569${randInt(40000000, 99999999)}`;
}

/** Distribuye N elementos según pesos {clave: peso}. Devuelve clave aleatoria. */
function weightedPick(weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [key, w] of Object.entries(weights)) {
    if (r < w) return key;
    r -= w;
  }
  return Object.keys(weights)[0];
}

// ── Runner ───────────────────────────────────────────────────────────────────
async function seedDemo() {
  const uri = process.env.ATLAS_URL;
  if (!uri) throw new Error('Falta la variable de entorno ATLAS_URL');

  await mongoose.connect(uri);
  console.log('✅ Conectado a MongoDB\n');

  // Productos y categorías existentes (necesarios para los ítems)
  const products = await Product.find({ isActive: true }).lean();
  if (products.length === 0) {
    throw new Error('No hay productos. Corre primero: npm run seed');
  }
  console.log(`🔩 ${products.length} productos disponibles para generar ítems`);

  // Cotizador para asignar createdBy
  const cotizador = await User.findOne({ role: ROLES.COTIZADOR }).lean();
  const adminUser = await User.findOne({ role: ROLES.ADMIN }).lean();
  const creatorId = cotizador?._id ?? adminUser?._id ?? null;

  // ── 1. CLIENTES ──────────────────────────────────────────────────────────
  console.log('\n👥 Generando clientes…');
  // Borra solo los clientes demo previos (marcados con notes='demo-seed')
  await Client.deleteMany({ notes: 'demo-seed' });

  const clientDocs = [];
  for (let i = 0; i < N_CLIENTS; i++) {
    const first = rand(FIRST_NAMES);
    const last  = rand(LAST_NAMES);
    const company = rand(COMPANIES);
    const name = `${first} ${last}`;
    clientDocs.push({
      name,
      company: company || undefined,
      rut: nextRut(),
      email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@demo.cl`,
      phone: randomPhone(),
      address: `${rand(['Av.', 'Calle', 'Pasaje'])} ${rand(LAST_NAMES)} ${randInt(100, 9999)}, ${rand(CITIES)}`,
      notes: 'demo-seed',
      isActive: Math.random() > 0.1, // 90% activos
      createdBy: creatorId,
      createdAt: randomDateWithinMonths(MONTHS_BACK),
      updatedAt: new Date(),
    });
  }
  const clients = await Client.insertMany(clientDocs, { timestamps: false });
  console.log(`   ✔ ${clients.length} clientes creados`);

  // ── 2. COTIZACIONES ──────────────────────────────────────────────────────
  console.log('\n📄 Generando cotizaciones…');
  await Quote.deleteMany({}); // limpia todas las cotizaciones previas

  const year = new Date().getFullYear();
  const quoteDocs = [];
  for (let i = 0; i < N_QUOTES; i++) {
    const client = rand(clients);
    const nItems = randInt(1, 4);
    const items = [];
    let subtotal = 0;

    for (let j = 0; j < nItems; j++) {
      const p = rand(products);
      const price = p.price || randInt(10000, 500000);
      const quantity = randInt(1, 6);
      const total = price * quantity;
      subtotal += total;
      items.push({
        productId: String(p._id),
        name: p.name,
        sku: p.sku || '',
        price,
        quantity,
        total,
      });
    }

    const iva = Math.round(subtotal * IVA_RATE);
    const status = weightedPick({ sent: 35, accepted: 40, rejected: 15, expired: 10 });
    const createdAt = randomDateWithinMonths(MONTHS_BACK);

    quoteDocs.push({
      folio: `Q-${year}-${String(i + 1).padStart(4, '0')}`,
      clientId: client._id,
      client: {
        customerType: client.company ? 'company' : 'person',
        name: client.name,
        email: client.email,
        phone: client.phone,
        company: client.company || '',
        taxId: client.rut || '',
        businessActivity: client.company ? 'Climatización' : '',
        notes: '',
      },
      items,
      totals: {
        subtotal,
        discount: 0,
        taxableBase: subtotal,
        iva,
        shipping: 0,
        total: subtotal + iva,
      },
      currency: 'CLP',
      paymentTerms: rand(['contado', '15-dias', '30-dias']),
      deliveryTerms: rand(['pickup', 'delivery', 'shipping']),
      validityDays: 30,
      validUntil: new Date(createdAt.getTime() + 30 * 24 * 60 * 60 * 1000),
      metadata: { status, createdAt: createdAt.toISOString() },
      createdAt,
      updatedAt: createdAt,
    });
  }
  const quotes = await Quote.insertMany(quoteDocs, { timestamps: false });
  console.log(`   ✔ ${quotes.length} cotizaciones creadas`);

  // ── 3. VENTAS ────────────────────────────────────────────────────────────
  console.log('\n🧾 Generando ventas…');
  await Sale.deleteMany({}); // limpia todas las ventas previas

  // Las ventas salen preferentemente de cotizaciones aceptadas
  const acceptedQuotes = quotes.filter((q) => q.metadata?.status === 'accepted');
  const sourceQuotes = acceptedQuotes.length >= N_SALES
    ? acceptedQuotes
    : quotes; // si no hay suficientes aceptadas, usa todas

  const saleDocs = [];
  for (let i = 0; i < N_SALES; i++) {
    const q = rand(sourceQuotes);
    const createdAt = randomDateWithinMonths(MONTHS_BACK);
    const status = weightedPick({ paid: 70, pending: 20, cancelled: 10 });

    saleDocs.push({
      folio: `V-${year}-${String(i + 1).padStart(4, '0')}`,
      quoteId: q._id,
      quoteFolio: q.folio,
      clientId: q.clientId,
      client: {
        name: q.client?.name || '',
        email: q.client?.email || '',
        phone: q.client?.phone || '',
        company: q.client?.company || '',
        taxId: q.client?.taxId || '',
      },
      items: (q.items || []).map((it) => ({
        productId: it.productId,
        name: it.name,
        sku: it.sku,
        price: it.price,
        quantity: it.quantity,
        total: it.total,
      })),
      totals: {
        subtotal: q.totals?.subtotal ?? 0,
        discount: q.totals?.discount ?? 0,
        iva: q.totals?.iva ?? 0,
        shipping: q.totals?.shipping ?? 0,
        total: q.totals?.total ?? 0,
      },
      currency: 'CLP',
      paymentMethod: rand(['transfer', 'card', 'cash', 'credit']),
      status,
      createdBy: creatorId,
      notes: '',
      createdAt,
      updatedAt: createdAt,
    });
  }
  const sales = await Sale.insertMany(saleDocs, { timestamps: false });
  console.log(`   ✔ ${sales.length} ventas creadas`);

  // ── Resumen ────────────────────────────────────────────────────────────────
  const paidRevenue = sales
    .filter((s) => s.status === 'paid')
    .reduce((a, s) => a + (s.totals?.total ?? 0), 0);
  const validRevenue = sales
    .filter((s) => s.status !== 'cancelled')
    .reduce((a, s) => a + (s.totals?.total ?? 0), 0);

  console.log('\n── Resumen ──');
  console.table({
    Clientes: clients.length,
    Cotizaciones: quotes.length,
    Ventas: sales.length,
    'Ingresos válidos': new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(validRevenue),
    'Ingresos pagados': new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(paidRevenue),
  });

  await mongoose.connection.close();
  console.log('\n🎉 Seed de demo completado. Revisa el dashboard.');
}

seedDemo().catch((err) => {
  console.error('❌ Error en seed-demo:', err.message);
  console.error(err);
  process.exit(1);
});
