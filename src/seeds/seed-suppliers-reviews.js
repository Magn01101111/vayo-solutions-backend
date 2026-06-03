/**
 * Seed de proveedores y reseñas de demo.
 *   - Crea ~5 proveedores globales.
 *   - Asigna 2-3 proveedores aleatorios a cada producto con tiempo de entrega.
 *   - Crea reseñas aprobadas en algunos productos.
 *
 * Uso: npm run seed:supreviews
 */
require('dotenv').config();
const mongoose = require('mongoose');

const Product  = require('../models/product.model');
const Supplier = require('../models/supplier.model');
const Review   = require('../models/review.model');
const Client   = require('../models/client.model');

const SUPPLIERS = [
  { name: 'TechParts Chile',   location: 'Santiago',    email: 'ventas@techparts.cl',   phone: '+56 2 2345 6789' },
  { name: 'FríoRepuestos S.A.',location: 'Valparaíso',  email: 'contacto@friorep.cl',   phone: '+56 32 245 6789' },
  { name: 'CoolTech Austral',  location: 'Concepción',  email: 'info@cooltech.cl',      phone: '+56 41 234 5678' },
  { name: 'ClimaSur Ltda',     location: 'Puerto Montt',email: 'ventas@climasur.cl',    phone: '+56 65 223 4567' },
  { name: 'HVAC Importadora',  location: 'Antofagasta', email: 'import@hvac.cl',        phone: '+56 55 256 7890' },
];

const DELIVERY = [
  { deliveryTime: '2-3 días', speed: 'fast' },
  { deliveryTime: '4-6 días', speed: 'mid' },
  { deliveryTime: '5-7 días', speed: 'mid' },
  { deliveryTime: '7-10 días', speed: 'slow' },
];

const REVIEW_TEMPLATES = [
  { rating: 5, body: 'Excelente repuesto, llegó en perfectas condiciones y en el plazo prometido. Funcionó a la primera.', tags: ['Envío rápido', 'Calidad original'], author: 'DataCenter Pro', company: 'DataCenter Pro' },
  { rating: 4, body: 'Buen producto, cumple con las especificaciones. El equipo quedó funcionando correctamente.', tags: ['Buen producto', 'Precio justo'], author: 'Marcela G.', company: 'TechCorp S.A.' },
  { rating: 5, body: 'Repuesto original, tal cual la descripción. Muy recomendado el proveedor.', tags: ['Calidad original'], author: 'Ingeniería Térmica', company: 'Ingeniería Térmica Ltda' },
  { rating: 4, body: 'Llegó bien embalado. La compatibilidad fue la indicada. Volveré a comprar.', tags: ['Fácil instalación'], author: 'Cristóbal M.', company: '' },
  { rating: 3, body: 'Funciona correctamente, aunque la entrega demoró un poco más de lo esperado.', tags: ['Buen producto'], author: 'Frío Industrial', company: 'Frío Industrial Ltda' },
];

const rand = (a) => a[Math.floor(Math.random() * a.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function run() {
  const uri = process.env.ATLAS_URL;
  if (!uri) throw new Error('Falta ATLAS_URL');
  await mongoose.connect(uri);
  console.log('✅ Conectado\n');

  // ── Proveedores ──
  await Supplier.deleteMany({});
  const suppliers = await Supplier.insertMany(SUPPLIERS);
  console.log(`🏭 ${suppliers.length} proveedores creados`);

  // ── Asignar proveedores a cada producto ──
  const products = await Product.find({});
  let assigned = 0;
  for (const p of products) {
    const n = randInt(2, 3);
    const pool = [...suppliers].sort(() => Math.random() - 0.5).slice(0, n);
    p.suppliers = pool.map((s) => {
      const d = rand(DELIVERY);
      return { supplier: s._id, deliveryTime: d.deliveryTime, speed: d.speed };
    });
    await p.save();
    assigned++;
  }
  console.log(`🔗 Proveedores asignados a ${assigned} productos`);

  // ── Reseñas aprobadas ──
  await Review.deleteMany({});
  const someClient = await Client.findOne({}).lean();
  let reviewCount = 0;
  for (const p of products) {
    // 60% de los productos tienen reseñas
    if (Math.random() > 0.6) continue;
    const n = randInt(1, 3);
    const templates = [...REVIEW_TEMPLATES].sort(() => Math.random() - 0.5).slice(0, n);
    for (const t of templates) {
      await Review.create({
        productId: p._id,
        // ObjectId ficticio único por reseña: evita colisión del índice único
        // {productId, userId} en datos de demo (en prod sería el id real del user).
        userId: new mongoose.Types.ObjectId(),
        clientId: someClient?._id ?? null,
        authorName: t.author,
        authorCompany: t.company,
        rating: t.rating,
        body: t.body,
        tags: t.tags,
        verified: Math.random() > 0.3,
        status: 'approved',
      });
      reviewCount++;
    }
  }
  console.log(`⭐ ${reviewCount} reseñas aprobadas creadas`);

  await mongoose.connection.close();
  console.log('\n🎉 Seed de proveedores y reseñas completado');
}

run().catch((err) => { console.error('❌', err.message); process.exit(1); });
