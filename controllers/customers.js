const Customer = require('../models/Customer');

// @desc    Get all customers
// @route   GET /api/v1/customers
// @access  Public
exports.getCustomers = async (req, res, next) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: customers.length,
      data: customers
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single customer
// @route   GET /api/v1/customers/:id
// @access  Public
exports.getCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: customer
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new customer
// @route   POST /api/v1/customers
// @access  Public
exports.createCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.create(req.body);
    
    res.status(201).json({
      success: true,
      data: customer
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update customer
// @route   PUT /api/v1/customers/:id
// @access  Public
exports.updateCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: customer
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete customer
// @route   DELETE /api/v1/customers/:id
// @access  Public
exports.deleteCustomer = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    await customer.deleteOne();
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete multiple customers
// @route   DELETE /api/v1/customers/bulk
// @access  Public
exports.deleteMultipleCustomers = async (req, res, next) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid customer IDs provided'
      });
    }

    const result = await Customer.deleteMany({ _id: { $in: ids } });
    
    res.status(200).json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Successfully deleted ${result.deletedCount} customer(s)`
    });
  } catch (err) {
    next(err);
  }
};