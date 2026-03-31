const express = require('express');
const { createProduct } = require('../controllers/product.controller');

const router = express.Router();

router.post('/', createProduct);

module.exports = router;