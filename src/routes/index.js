const express = require('express');

const healthRoutes  = require('./health.routes');
const authRoutes    = require('./auth.routes');
const userRoutes    = require('./user.routes');
const categoryRoutes = require('./category.routes');
const productRoutes = require('./product.routes');
const clientRoutes  = require('./client.routes');
const companyRoutes = require('./company.routes');
const quoteRoutes   = require('./quote.routes');

const router = express.Router();

// Públicas
router.use('/',             healthRoutes);
router.use('/api/auth',     authRoutes);

// Protegidas (auth se aplica dentro de cada router)
router.use('/api/users',      userRoutes);
router.use('/api/categories', categoryRoutes);
router.use('/api/products',   productRoutes);
router.use('/api/clients',    clientRoutes);
router.use('/api/company',    companyRoutes);
router.use('/api/quotes',     quoteRoutes);

module.exports = router;
