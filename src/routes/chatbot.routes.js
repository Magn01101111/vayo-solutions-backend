const express = require('express');
const { searchProducts } = require('../controllers/chatbot.controller');

const router = express.Router();

// Endpoint publico para asistentes/chatbots.
router.get('/products/search', searchProducts);

module.exports = router;
