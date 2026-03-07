const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const { 
  getCustomers, 
  getCustomer, 
  createCustomer, 
  updateCustomer, 
  deleteCustomer,
  deleteMultipleCustomers,
  addAdvancePayment,
  useAdvancePayment
} = require('../controllers/customers');

// Input validation middleware
const validateCustomerInput = [
  check('name', 'Name is required').not().isEmpty(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  }
];

// Customer routes
router.route('/')
  .get(getCustomers)
  .post(validateCustomerInput, createCustomer);

// Delete multiple customers
router.route('/bulk')
  .delete(deleteMultipleCustomers);

router.route('/:id')
  .get(getCustomer)
  .put(updateCustomer)
  .delete(deleteCustomer);

// Advance payment routes
router.route('/:id/advance-payment')
  .post(addAdvancePayment);

router.route('/:id/use-advance-payment')
  .post(useAdvancePayment);

module.exports = router;
