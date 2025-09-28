const Transaction = require('../models/Transaction');
const Customer = require('../models/Customer');

// @desc    Get all transactions
// @route   GET /api/v1/transactions
// @access  Public
exports.getTransactions = async (req, res, next) => {
  try {
    // Build query
    let query = {};
    
    // Filter by customer
    if (req.query.customerId) {
      query.customerId = req.query.customerId;
    }
    
    // Filter by type
    if (req.query.type) {
      query.type = req.query.type;
    }
    
    // Filter by status
    if (req.query.status) {
      query.status = req.query.status;
    }
    
    // Date range filter
    if (req.query.startDate && req.query.endDate) {
      query.date = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    }
    
    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    
    const transactions = await Transaction.find(query)
      .sort({ date: -1 })
      .skip(startIndex)
      .limit(limit)
      .populate('customerId', 'name');
    
    // Get total count for pagination
    const total = await Transaction.countDocuments(query);
    
    res.status(200).json({
      success: true,
      count: transactions.length,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      },
      data: transactions
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single transaction
// @route   GET /api/v1/transactions/:id
// @access  Public
exports.getTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('customerId', 'name');
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new transaction
// @route   POST /api/v1/transactions
// @access  Public
exports.createTransaction = async (req, res, next) => {
  try {
    // Check if customer exists
    const customer = await Customer.findById(req.body.customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    // Create transaction
    const transaction = await Transaction.create({
      ...req.body,
      customerName: customer.name
    });
    
    // Update customer balance based on transaction type
    if (req.body.type === 'payment' && req.body.status === 'completed') {
      customer.totalPaid += req.body.amount;
      customer.balance -= req.body.amount;
      await customer.save();
    } else if (req.body.type === 'invoice') {
      customer.totalCredit += req.body.amount;
      customer.balance += req.body.amount;
      await customer.save();
    }
    
    res.status(201).json({
      success: true,
      data: transaction
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update transaction
// @route   PUT /api/v1/transactions/:id
// @access  Public
exports.updateTransaction = async (req, res, next) => {
  try {
    let transaction = await Transaction.findById(req.params.id);
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }
    
    // If status is changing from/to completed, update customer balance
    if (req.body.status && req.body.status !== transaction.status) {
      const customer = await Customer.findById(transaction.customerId);
      
      if (customer) {
        // If transaction was completed and now it's not
        if (transaction.status === 'completed' && req.body.status !== 'completed') {
          if (transaction.type === 'payment') {
            customer.totalPaid -= transaction.amount;
            customer.balance += transaction.amount;
          } else if (transaction.type === 'invoice') {
            customer.totalCredit -= transaction.amount;
            customer.balance -= transaction.amount;
          }
        }
        // If transaction was not completed and now it is
        else if (transaction.status !== 'completed' && req.body.status === 'completed') {
          if (transaction.type === 'payment') {
            customer.totalPaid += transaction.amount;
            customer.balance -= transaction.amount;
          } else if (transaction.type === 'invoice') {
            customer.totalCredit += transaction.amount;
            customer.balance += transaction.amount;
          }
        }
        
        await customer.save();
      }
    }
    
    transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      success: true,
      data: transaction
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete transaction
// @route   DELETE /api/v1/transactions/:id
// @access  Public
exports.deleteTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }
    
    // Update customer balance if transaction was completed
    if (transaction.status === 'completed') {
      const customer = await Customer.findById(transaction.customerId);
      
      if (customer) {
        if (transaction.type === 'payment') {
          customer.totalPaid -= transaction.amount;
          customer.balance += transaction.amount;
        } else if (transaction.type === 'invoice') {
          customer.totalCredit -= transaction.amount;
          customer.balance -= transaction.amount;
        }
        
        await customer.save();
      }
    }
    
    await transaction.deleteOne();
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get transaction statistics
// @route   GET /api/v1/transactions/stats
// @access  Public
exports.getTransactionStats = async (req, res, next) => {
  try {
    const stats = await Transaction.aggregate([
      {
        $group: {
          _id: null,
          totalSales: {
            $sum: {
              $cond: [{ $eq: ["$type", "invoice"] }, "$amount", 0]
            }
          },
          totalPayments: {
            $sum: {
              $cond: [{ $eq: ["$type", "payment"] }, "$amount", 0]
            }
          },
          totalOutstanding: {
            $sum: {
              $cond: [
                { $and: [
                  { $eq: ["$type", "invoice"] },
                  { $eq: ["$status", "pending"] }
                ]},
                "$amount",
                0
              ]
            }
          },
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Get customer count
    const customerCount = await Customer.countDocuments();
    
    // Get overdue invoices (more than 30 days old and still pending)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const overdueCount = await Transaction.countDocuments({
      type: 'invoice',
      status: 'pending',
      date: { $lt: thirtyDaysAgo }
    });
    
    res.status(200).json({
      success: true,
      data: {
        totalCustomers: customerCount,
        totalSales: stats.length > 0 ? stats[0].totalSales : 0,
        totalPayments: stats.length > 0 ? stats[0].totalPayments : 0,
        totalOutstanding: stats.length > 0 ? stats[0].totalOutstanding : 0,
        overdueCount,
        transactionCount: stats.length > 0 ? stats[0].count : 0
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete multiple transactions
// @route   DELETE /api/v1/transactions/bulk
// @access  Public
exports.deleteMultipleTransactions = async (req, res, next) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid transaction IDs provided'
      });
    }

    // Get transactions to update customer balances
    const transactions = await Transaction.find({ _id: { $in: ids } });
    
    // Update customer balances for completed transactions
    for (const transaction of transactions) {
      if (transaction.status === 'completed') {
        const customer = await Customer.findById(transaction.customerId);
        
        if (customer) {
          if (transaction.type === 'payment') {
            customer.totalPaid -= transaction.amount;
            customer.balance += transaction.amount;
          } else if (transaction.type === 'invoice') {
            customer.totalCredit -= transaction.amount;
            customer.balance -= transaction.amount;
          }
          
          await customer.save();
        }
      }
    }

    const result = await Transaction.deleteMany({ _id: { $in: ids } });
    
    res.status(200).json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Successfully deleted ${result.deletedCount} transaction(s)`
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get due date alerts
// @route   GET /api/v1/transactions/due-date-alerts
// @access  Public
exports.getDueDateAlerts = async (req, res, next) => {
  try {
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);
    
    // Get pending invoices that are due soon or overdue
    const pendingInvoices = await Transaction.find({
      type: 'invoice',
      status: 'pending',
      $or: [
        { dueDate: { $lte: sevenDaysFromNow } }, // Due within 7 days
        { dueDate: { $lt: now } } // Overdue
      ]
    })
    .populate('customerId', 'name phone balance totalCredit totalPaid')
    .sort({ dueDate: 1 });
    
    const alerts = pendingInvoices.map(transaction => {
      const dueDate = new Date(transaction.dueDate);
      const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
      const daysOverdue = Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24));
      
      let alertType = 'due_soon';
      let priority = 'low';
      
      if (daysUntilDue < 0) {
        alertType = 'overdue';
        if (daysOverdue >= 30) {
          priority = 'urgent';
        } else if (daysOverdue >= 14) {
          priority = 'high';
        } else if (daysOverdue >= 7) {
          priority = 'medium';
        }
      } else if (daysUntilDue === 0) {
        priority = 'high';
      } else if (daysUntilDue <= 3) {
        priority = 'medium';
      }
      
      const customerBalance = typeof transaction.customerId?.balance === 'number'
        ? Math.max(transaction.customerId.balance, 0)
        : undefined;
      const outstandingAmount = customerBalance !== undefined ? customerBalance : transaction.amount;
      
      return {
        id: transaction._id.toString(),
        customerName: transaction.customerName || transaction.customerId?.name || 'Unknown Customer',
        amount: outstandingAmount,
        originalAmount: transaction.amount,
        dueDate: transaction.dueDate,
        alertType,
        daysUntilDue: daysUntilDue >= 0 ? daysUntilDue : undefined,
        daysOverdue: daysUntilDue < 0 ? daysOverdue : undefined,
        priority,
        customer: transaction.customerId ? {
          name: transaction.customerId.name,
          phone: transaction.customerId.phone,
          balance: transaction.customerId.balance,
          totalCredit: transaction.customerId.totalCredit,
          totalPaid: transaction.customerId.totalPaid
        } : undefined
      };
    });
    
    res.status(200).json({
      success: true,
      data: alerts
    });
  } catch (err) {
    next(err);
  }
};