const Product = require('../models/Product');

// @desc    Get all products
// @route   GET /api/v1/products
// @access  Public
exports.getProducts = async (req, res, next) => {
  try {
    const products = await Product.find().sort({ name: 1 });
    
    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single product
// @route   GET /api/v1/products/:id
// @access  Public
exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: product
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new product
// @route   POST /api/v1/products
// @access  Public
exports.createProduct = async (req, res, next) => {
  try {
    const product = await Product.create(req.body);
    
    res.status(201).json({
      success: true,
      data: product
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update product
// @route   PUT /api/v1/products/:id
// @access  Public
exports.updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: product
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete product
// @route   DELETE /api/v1/products/:id
// @access  Public
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    await product.deleteOne();
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete multiple products
// @route   DELETE /api/v1/products/bulk
// @access  Public
exports.deleteMultipleProducts = async (req, res, next) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid product IDs provided'
      });
    }

    const result = await Product.deleteMany({ _id: { $in: ids } });
    
    res.status(200).json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Successfully deleted ${result.deletedCount} product(s)`
    });
  } catch (err) {
    next(err);
  }
};