const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const {
  getProducts, 
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  deleteMultipleProducts
} = require('../controllers/products');

// Input validation middleware
const validateProductInput = [
  check('name', 'Name is required').not().isEmpty(),
  check('price', 'Price is required and must be a number').isNumeric(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  }
];

// Product routes
router.route('/')
  .get(getProducts)
  .post(validateProductInput, createProduct);

// Delete multiple products
router.route('/bulk')
  .delete(deleteMultipleProducts);

router.route('/:id')
  .get(getProduct)
  .put(validateProductInput, updateProduct)
  .delete(deleteProduct);

module.exports = router;