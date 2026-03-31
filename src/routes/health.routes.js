const express = require('express');
const {
  healthCheck,
  testDB,
  home,
} = require('../controllers/health.controller');

const router = express.Router();

router.get('/', home);
router.get('/health', healthCheck);
router.get('/test-db', testDB);

module.exports = router;