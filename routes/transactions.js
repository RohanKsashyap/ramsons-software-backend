const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const {
  getTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  deleteMultipleTransactions,
  getTransactionStats,
  getDueDateAlerts
} = require('../controllers/transactions');

// Input validation middleware
const validateTransactionInput = [
  check('customerId', 'Customer ID is required').not().isEmpty(),
  check('type', 'Transaction type is required').not().isEmpty(),
  check('amount', 'Amount is required').isNumeric(),
  check('status', 'Status is required').not().isEmpty(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  }
];

// Transaction routes
router.route('/stats').get(getTransactionStats);
router.route('/due-date-alerts').get(getDueDateAlerts);

// Delete multiple transactions
router.route('/bulk')
  .delete(deleteMultipleTransactions);

router.route('/')
  .get(getTransactions)
  .post(validateTransactionInput, createTransaction);

router.route('/:id')
  .get(getTransaction)
  .put(updateTransaction)
  .delete(deleteTransaction);

module.exports = router;