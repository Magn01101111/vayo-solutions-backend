const express = require('express');

const healthRoutes  = require('./health.routes');
const authRoutes    = require('./auth.routes');
const userRoutes    = require('./user.routes');
const categoryRoutes = require('./category.routes');
const productRoutes = require('./product.routes');
const clientRoutes  = require('./client.routes');
const companyRoutes = require('./company.routes');
const quoteRoutes   = require('./quote.routes');
const saleRoutes    = require('./sale.routes');
const statsRoutes   = require('./stats.routes');
const reportRoutes  = require('./report.routes');
const supplierRoutes = require('./supplier.routes');
const reviewRoutes  = require('./review.routes');
const couponRoutes  = require('./coupon.routes');
const bannerRoutes  = require('./banner.routes');
const favoriteRoutes = require('./favorite.routes');
const uploadRoutes  = require('./upload.routes.js');
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
router.use('/api/sales',      saleRoutes);
router.use('/api/stats',      statsRoutes);
router.use('/api/reports',    reportRoutes);
router.use('/api/suppliers',  supplierRoutes);
router.use('/api/reviews',    reviewRoutes);
router.use('/api/coupons',    couponRoutes);
router.use('/api/banners',    bannerRoutes);
router.use('/api/favorites',  favoriteRoutes);

router.use('/api/upload', uploadRoutes);

module.exports = router;
