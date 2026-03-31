const express = require('express');
const healthRoutes = require('./health.routes');
const userRoutes = require('./user.routes');
const categoryRoutes = require('./category.routes');
const productRoutes = require('./product.routes');
const adminProductRoutes = require('./admin.product.routes');

const router = express.Router();

router.use('/', healthRoutes);
router.use('/api/users', userRoutes);
router.use('/api/categories', categoryRoutes);
router.use('/api/products', productRoutes);
router.use('/api/admin/products', adminProductRoutes);

module.exports = router;