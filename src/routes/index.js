const express = require('express');
const healthRoutes = require('./health.routes');
const userRoutes = require('./user.routes');

const router = express.Router();

router.use('/', healthRoutes);
router.use('/api/users', userRoutes);

module.exports = router;