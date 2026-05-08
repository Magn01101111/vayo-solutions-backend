const express = require('express');
const router = express.Router();

const quoteRoutes = require('./routes/quote.routes');

router.use('/quote', quoteRoutes);

module.exports = router;
