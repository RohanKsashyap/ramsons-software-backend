const express = require('express');
const router = express.Router();
const {
  getInventory,
  getProductInventory,
  adjustInventory,
  addStock,
  deductSale,
  getAuditLogs,
  getLowStockProducts,
  getInventoryReport,
  updateReorderLevel
} = require('../controllers/inventory');

// POST routes first
router.post('/adjust', adjustInventory);
router.post('/add-stock', addStock);
router.post('/deduct-sale', deductSale);

// GET specific routes before parameterized routes
router.get('/low-stock', getLowStockProducts);
router.get('/audits', getAuditLogs);
router.get('/report', getInventoryReport);

// PUT routes
router.put('/:productId/reorder-level', updateReorderLevel);

// GET parameterized routes last
router.get('/:productId', getProductInventory);

// Get all inventory
router.get('/', getInventory);

module.exports = router;
