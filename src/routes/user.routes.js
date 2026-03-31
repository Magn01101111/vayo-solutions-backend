const express = require('express');
const {
  getUsers,
  createTestUser,
} = require('../controllers/user.controller');

const router = express.Router();

router.get('/', getUsers);
router.post('/seed-test', createTestUser);

module.exports = router;