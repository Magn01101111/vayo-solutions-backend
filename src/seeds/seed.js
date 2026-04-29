/**
 * Seed completo VAYO — Sprint 1
 * Inserta: usuario admin, categorías, productos de muestra, config empresa
 *
 * Uso: npm run seed
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User     = require('../models/user.model');
const Category = require('../models/category.model');
const Product  = require('../models/product.model');
const Company  = require('../models/company.model');
const { ROLES } = require('../constants/roles');

// ── Datos ──────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { name: 'Compresores',  slug: 'compresores',  description: 'Repuestos para compresores de climatización.' },
  { name: 'Ventiladores', slug: 'ventiladores', description: 'Ventiladores axiales, centrífugos y componentes.' },
  { name: 'Válvulas',     slug: 'valvulas',     description: 'Válvulas y componentes de control HVAC.' },
  { name: 'Sensores',     slug: 'sensores',     description: 'Sensores de temperatura, presión y monitoreo.' },
  { name: 'Filtros',      slug: 'filtros',      description: 'Filtros secadores y elementos de filtrado.' },
  { name: 'Motores',      slug: 'motores',      description: 'Motores eléctricos para sistemas de climatización.' },
];

const USERS = [
  {
    name: 'Administrador VAYO',
    email: 'admin@vayo.cl',
    password: 'Admin2026!',
    role: ROLES.ADMIN,
  },
  {
    name: 'Juan Cotizador',
    email: 'cotizador@vayo.cl',
    password: 'Cotiz2026!',
    role: ROLES.COTIZADOR,
  },
  {
    name: 'Proveedor Demo',
    email: 'proveedor@vayo.cl',
    password: 'Prov2026!',
    role: ROLES.PROVEEDOR,
  },
];

const COMPANY = {
  name: 'VAYO Solutions',
  rut: '76.000.000-0',
  address: 'Av. Providencia 1234, Santiago, Chile',
  phone: '+56 2 2000 0000',
  email: 'contacto@vayo.cl',
  website: 'https://vayo.cl',
  ivaPercent: 19,
  invoiceTerms: 'Precios no incluyen IVA. Validez de cotización: 15 días hábiles.',
};

// ── Runner ─────────────────────────────────────────────────────────────────────

async function seed() {
  const uri = process.env.ATLAS_URL;
  if (!uri) throw new Error('Falta la variable de entorno ATLAS_URL');

  await mongoose.connect(uri);
  console.log('✅ Conectado a MongoDB\n');

  // Empresa (singleton)
  await Company.deleteMany({});
  await Company.create(COMPANY);
  console.log('🏢 Configuración de empresa insertada');

  // Categorías
  await Category.deleteMany({});
  const savedCategories = await Category.insertMany(CATEGORIES);
  console.log(`📦 ${savedCategories.length} categorías insertadas`);

  const catMap = {};
  savedCategories.forEach((c) => { catMap[c.slug] = c._id; });

  // Usuarios (elimina los de seed previo, mantiene otros)
  const seedEmails = USERS.map((u) => u.email);
  await User.deleteMany({ email: { $in: seedEmails } });
  for (const userData of USERS) {
    const user = new User(userData);
    await user.save(); // dispara el pre-save de bcrypt
    console.log(`👤 Usuario creado: ${userData.email} (${userData.role})`);
  }

  // Productos de muestra
  await Product.deleteMany({});
  const products = [
    {
      category: catMap['compresores'],
      name: 'Compresor Scroll 5 Ton',
      sku: 'CMP-SCR-5T',
      brand: 'Copeland',
      model: 'ZR61KCE-TFD',
      price: 850000,
      stock: 3,
      availabilityStatus: 'in_stock',
      description: 'Compresor scroll hermético para sistema de 5 toneladas.',
      tags: ['compresor', 'scroll', 'copeland'],
    },
    {
      category: catMap['ventiladores'],
      name: 'Ventilador Axial 16"',
      sku: 'VNT-AXL-16',
      brand: 'Ebm-papst',
      model: 'A3G500-AM33-02',
      price: 125000,
      stock: 10,
      availabilityStatus: 'in_stock',
      description: 'Ventilador axial de alto rendimiento para condensadores.',
      tags: ['ventilador', 'axial'],
    },
    {
      category: catMap['valvulas'],
      name: 'Válvula de Expansión Termostática R410a',
      sku: 'VLV-TXV-R410',
      brand: 'Danfoss',
      model: 'TGES 10',
      price: 48000,
      stock: 15,
      availabilityStatus: 'in_stock',
      description: 'VET para refrigerante R410a, capacidad 10 kW.',
      tags: ['valvula', 'expansion', 'r410a'],
    },
    {
      category: catMap['sensores'],
      name: 'Sensor de Temperatura NTC 10K',
      sku: 'SNS-NTC-10K',
      brand: 'Honeywell',
      model: 'NTC-10K-B',
      price: 8500,
      stock: 50,
      availabilityStatus: 'in_stock',
      description: 'Sensor NTC para control de temperatura en unidades Fan Coil.',
      tags: ['sensor', 'temperatura', 'ntc'],
    },
    {
      category: catMap['filtros'],
      name: 'Filtro Secador 3/8" Bi-Flujo',
      sku: 'FLT-DRY-38',
      brand: 'Emerson',
      model: 'EK-032S',
      price: 12000,
      stock: 30,
      availabilityStatus: 'in_stock',
      description: 'Filtro secador bi-flujo para refrigerantes R22/R410a.',
      tags: ['filtro', 'secador'],
    },
    {
      category: catMap['motores'],
      name: 'Motor Evaporador 1/3 HP',
      sku: 'MTR-EVP-033',
      brand: 'WEG',
      model: 'W21-056',
      price: 38000,
      stock: 8,
      availabilityStatus: 'in_stock',
      description: 'Motor para evaporadores de fan coil, 220V bifásico.',
      tags: ['motor', 'evaporador', 'weg'],
    },
  ];

  const savedProducts = await Product.insertMany(products);
  console.log(`🔩 ${savedProducts.length} productos de muestra insertados`);

  await mongoose.connection.close();
  console.log('\n🎉 Seed completado exitosamente');
}

seed().catch((err) => {
  console.error('❌ Error en seed:', err.message);
  process.exit(1);
});
