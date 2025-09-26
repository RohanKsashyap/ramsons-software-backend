const express = require('express');
const {
  register,
  login,
  requestReset,
  resetPassword,
} = require('../controllers/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/reset/request', requestReset);
router.post('/reset/confirm', resetPassword);

module.exports = router;