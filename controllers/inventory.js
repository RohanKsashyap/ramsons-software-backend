const Product = require('../models/Product');
const InventoryAudit = require('../models/InventoryAudit');

// @desc    Get all inventory
// @route   GET /api/v1/inventory
// @access  Public
exports.getInventory = async (req, res, next) => {
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

// @desc    Get inventory for single product
// @route   GET /api/v1/inventory/:productId
// @access  Public
exports.getProductInventory = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.productId);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    const audits = await InventoryAudit.find({ productId: req.params.productId })
      .sort({ date: -1 })
      .limit(20);
    
    res.status(200).json({
      success: true,
      data: {
        product,
        recentAudits: audits
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add/adjust inventory for a product
// @route   POST /api/v1/inventory/adjust
// @access  Public
exports.adjustInventory = async (req, res, next) => {
  try {
    const { productId, quantityChange, reason, notes, performedBy } = req.body;
    
    if (!productId || quantityChange === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Product ID and quantity change are required'
      });
    }
    
    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    const previousQuantity = product.quantity;
    const newQuantity = previousQuantity + quantityChange;
    
    if (newQuantity < 0) {
      return res.status(400).json({
        success: false,
        error: 'Adjustment would result in negative inventory'
      });
    }
    
    product.quantity = newQuantity;
    await product.save();
    
    const audit = await InventoryAudit.create({
      productId,
      productName: product.name,
      type: 'adjustment',
      quantityChange: Math.abs(quantityChange),
      previousQuantity,
      newQuantity,
      reason: reason || 'Manual adjustment',
      performedBy: performedBy || 'admin',
      notes
    });
    
    res.status(201).json({
      success: true,
      data: {
        product,
        audit
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add new stock to product
// @route   POST /api/v1/inventory/add-stock
// @access  Public
exports.addStock = async (req, res, next) => {
  try {
    const { productId, quantity, performedBy, notes } = req.body;
    
    if (!productId || !quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Product ID and valid quantity are required'
      });
    }
    
    const product = await Product.findById(productId);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    const previousQuantity = product.quantity;
    product.quantity += quantity;
    await product.save();
    
    const audit = await InventoryAudit.create({
      productId,
      productName: product.name,
      type: 'add',
      quantityChange: quantity,
      previousQuantity,
      newQuantity: product.quantity,
      reason: 'Stock addition',
      performedBy: performedBy || 'admin',
      notes
    });
    
    res.status(201).json({
      success: true,
      data: {
        product,
        audit
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Record inventory deduction from sale
// @route   POST /api/v1/inventory/deduct-sale
// @access  Public
exports.deductSale = async (req, res, next) => {
  try {
    const { items, transactionId } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Items array is required'
      });
    }
    
    const audits = [];
    
    for (const item of items) {
      const productId = item.productId || item.product;
      const quantity = item.quantity;
      
      if (!productId || !quantity) {
        continue;
      }
      
      const product = await Product.findById(productId);
      
      if (!product) {
        continue;
      }
      
      if (product.quantity < quantity) {
        return res.status(400).json({
          success: false,
          error: `Insufficient inventory for product: ${product.name}`
        });
      }
      
      const previousQuantity = product.quantity;
      product.quantity -= quantity;
      await product.save();
      
      const audit = await InventoryAudit.create({
        productId,
        productName: product.name,
        type: 'sale',
        quantityChange: quantity,
        previousQuantity,
        newQuantity: product.quantity,
        reason: 'Sale',
        transactionId: transactionId || null,
        performedBy: 'system',
        notes: `Sale transaction - ${quantity} units sold`
      });
      
      audits.push(audit);
    }
    
    res.status(201).json({
      success: true,
      data: {
        audits
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get inventory audit logs
// @route   GET /api/v1/inventory/audits
// @access  Public
exports.getAuditLogs = async (req, res, next) => {
  try {
    const { productId, type, startDate, endDate, limit = 50, page = 1 } = req.query;
    
    let query = {};
    
    if (productId) {
      query.productId = productId;
    }
    
    if (type) {
      query.type = type;
    }
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }
    
    const skip = (page - 1) * limit;
    
    const audits = await InventoryAudit.find(query)
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .skip(skip);
    
    const total = await InventoryAudit.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: audits.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: audits
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get products with low inventory
// @route   GET /api/v1/inventory/low-stock
// @access  Public
exports.getLowStockProducts = async (req, res, next) => {
  try {
    const products = await Product.find({
      $expr: { $lte: ['$quantity', '$reorderLevel'] }
    }).sort({ quantity: 1 });
    
    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get inventory audit report
// @route   GET /api/v1/inventory/report
// @access  Public
exports.getInventoryReport = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = {};
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate);
      }
    }
    
    const audits = await InventoryAudit.find(query).sort({ date: -1 });
    
    const summary = {
      totalAdditions: 0,
      totalAdjustments: 0,
      totalSales: 0,
      totalReturns: 0,
      auditsByType: {},
      auditsByProduct: {}
    };
    
    audits.forEach(audit => {
      switch(audit.type) {
        case 'add':
          summary.totalAdditions += audit.quantityChange;
          break;
        case 'adjustment':
          summary.totalAdjustments += audit.quantityChange;
          break;
        case 'sale':
          summary.totalSales += audit.quantityChange;
          break;
        case 'return':
          summary.totalReturns += audit.quantityChange;
          break;
      }
      
      summary.auditsByType[audit.type] = (summary.auditsByType[audit.type] || 0) + 1;
      summary.auditsByProduct[audit.productName] = (summary.auditsByProduct[audit.productName] || 0) + 1;
    });
    
    res.status(200).json({
      success: true,
      summary,
      auditCount: audits.length,
      data: audits
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update product reorder level
// @route   PUT /api/v1/inventory/:productId/reorder-level
// @access  Public
exports.updateReorderLevel = async (req, res, next) => {
  try {
    const { reorderLevel } = req.body;
    
    if (reorderLevel === undefined || reorderLevel < 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid reorder level is required'
      });
    }
    
    const product = await Product.findByIdAndUpdate(
      req.params.productId,
      { reorderLevel },
      { new: true, runValidators: true }
    );
    
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
