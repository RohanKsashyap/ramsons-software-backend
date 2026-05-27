const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const PaymentAllocation = require('../models/PaymentAllocation');
const { recalculateCustomerTotals, allocatePayments } = require('../services/ledgerService');

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

// @desc    Add advance payment to customer
// @route   POST /api/v1/customers/:id/advance-payment
// @access  Public
exports.addAdvancePayment = async (req, res, next) => {
  try {
    const { amount } = req.body;
    
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid amount'
      });
    }
    
    const customer = await Customer.findById(req.params.id);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    // Add to advance payment
    customer.advancePayment = (customer.advancePayment || 0) + parseFloat(amount);
    
    await customer.save();

    // Create a transaction record for the advance payment
    const Transaction = require('../models/Transaction');
    const { recalculateCustomerBalance } = require('./transactions');
    
    const transaction = await Transaction.create({
      customerId: customer._id,
      customerName: customer.name,
      type: 'advance',
      amount: parseFloat(amount),
      status: 'completed',
      description: 'Advance payment received',
      date: new Date()
    });

    // Mirror to Payment model for the new Ledger system
    await Payment.create({
      customerId: customer._id,
      paymentNumber: `ADV-${transaction._id.toString().slice(-6).toUpperCase()}`,
      amount: parseFloat(amount),
      paymentMethod: 'cash', // Default for direct advance
      notes: 'Advance payment received',
      date: transaction.date
    });

    // Trigger allocation and totals update for the new system
    await allocatePayments(customer._id);
    await recalculateCustomerTotals(customer._id);

    // Recalculate customer balance (original system)
    const updatedCustomer = await recalculateCustomerBalance(customer._id);
    
    res.status(200).json({
      success: true,
      data: updatedCustomer
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Use advance payment for purchase
// @route   POST /api/v1/customers/:id/use-advance
// @access  Public
exports.useAdvancePayment = async (req, res, next) => {
  try {
    const { amount } = req.body;
    
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid amount'
      });
    }
    
    const customer = await Customer.findById(req.params.id);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    if (!customer.advancePayment || customer.advancePayment < amount) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient advance payment balance'
      });
    }
    
    // Deduct from advance payment
    customer.advancePayment -= parseFloat(amount);
    
    await customer.save();
    
    res.status(200).json({
      success: true,
      data: customer
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get customer complete details (Ledger, Invoices, Payments, Allocations)
// @route   GET /api/v1/customers/:id/details
// @access  Public
exports.getCustomerDetails = async (req, res, next) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    // Get all invoices with allocations
    const invoices = await Invoice.find({ customerId: req.params.id }).sort({ date: 1, createdAt: 1 });
    const invoicesWithAllocations = await Promise.all(invoices.map(async (inv) => {
      const allocations = await PaymentAllocation.find({ invoiceId: inv._id })
        .populate('paymentId', 'paymentNumber date');
      
      return {
        ...inv.toObject(),
        allocations: allocations.map(al => ({
          paymentId: al.paymentId?._id,
          paymentNumber: al.paymentId?.paymentNumber || (al.paymentId?._id ? `PAY-${al.paymentId._id.toString().slice(-6).toUpperCase()}` : 'PAY-UNKNOWN'),
          allocatedAmount: al.allocatedAmount,
          paymentDate: al.paymentId?.date
        }))
      };
    }));

    // Get all payments with allocations
    const payments = await Payment.find({ customerId: req.params.id }).sort({ date: 1, createdAt: 1 });
    const paymentsWithAllocations = await Promise.all(payments.map(async (pay) => {
      const allocations = await PaymentAllocation.find({ paymentId: pay._id })
        .populate('invoiceId', 'invoiceNumber');
      
      return {
        ...pay.toObject(),
        allocations: allocations.map(al => ({
          invoiceId: al.invoiceId?._id,
          invoiceNumber: al.invoiceId?.invoiceNumber || (al.invoiceId?._id ? `INV-${al.invoiceId._id.toString().slice(-6).toUpperCase()}` : 'INV-UNKNOWN'),
          allocatedAmount: al.allocatedAmount
        }))
      };
    }));

    // Generate Ledger History
    const ledgerHistory = [];
    let runningBalance = 0;

    // Combine invoices and payments for chronological history
    const allTransactions = [
      ...invoices.map(inv => ({ ...inv.toObject(), ledgerType: 'invoice' })),
      ...payments.map(pay => ({ ...pay.toObject(), ledgerType: 'payment' }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    allTransactions.forEach(tx => {
      if (tx.ledgerType === 'invoice') {
        runningBalance += tx.totalAmount;
        ledgerHistory.push({
          date: tx.date,
          type: 'Invoice',
          reference: tx.invoiceNumber,
          debit: tx.totalAmount,
          credit: 0,
          runningBalance
        });
      } else {
        runningBalance -= tx.amount;
        ledgerHistory.push({
          date: tx.date,
          type: 'Payment',
          reference: tx.paymentNumber,
          debit: 0,
          credit: tx.amount,
          runningBalance
        });
      }
    });

    // Get totals
    const totals = await recalculateCustomerTotals(req.params.id);

    res.status(200).json({
      success: true,
      data: {
        customerInfo: customer,
        totals,
        ledgerHistory,
        invoices: invoicesWithAllocations,
        payments: paymentsWithAllocations
      }
    });
  } catch (err) {
    next(err);
  }
};
