const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getMonthlyRevenue
} = require('../controllers/dashboard');

// Dashboard routes
router.route('/stats').get(getDashboardStats);
router.route('/monthly-revenue').get(getMonthlyRevenue);

module.exports = router;