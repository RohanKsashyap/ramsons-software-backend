const Transaction = require('../models/Transaction');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const InventoryAudit = require('../models/InventoryAudit');

// Helper function to deduct inventory on sales
async function deductInventoryOnSale(items, transactionId) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return;
  }

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
      throw new Error(`Insufficient inventory for product: ${product.name}. Available: ${product.quantity}, Requested: ${quantity}`);
    }
    
    const previousQuantity = product.quantity;
    product.quantity -= quantity;
    await product.save();
    
    await InventoryAudit.create({
      productId,
      productName: product.name,
      type: 'sale',
      quantityChange: quantity,
      previousQuantity,
      newQuantity: product.quantity,
      reason: 'Sale transaction',
      transactionId: transactionId || null,
      performedBy: 'system',
      notes: `Sale - ${quantity} units sold`
    });
  }
}

// Helper function to restore inventory when an invoice is deleted
async function restoreInventoryOnDeletion(items, transactionId) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return;
  }

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
    
    const previousQuantity = product.quantity;
    product.quantity += quantity;
    await product.save();
    
    await InventoryAudit.create({
      productId,
      productName: product.name,
      type: 'restock',
      quantityChange: quantity,
      previousQuantity,
      newQuantity: product.quantity,
      reason: 'Transaction deletion rollback',
      transactionId: transactionId || null,
      performedBy: 'system',
      notes: `Rollback - ${quantity} units restored due to transaction deletion`
    });
  }
}

// Helper function to mark invoices as completed when fully paid
async function updateInvoiceStatusIfPaid(customerId) {
  const customer = await Customer.findById(customerId);
  if (!customer) return;

  // Get all invoices for this customer (not just pending, to re-evaluate everything)
  const allInvoices = await Transaction.find({
    customerId: customerId,
    type: 'invoice'
  }).sort({ date: 1, createdAt: 1 });

  // Get all completed payments (include both regular and advance usage)
  const totalPayments = await Transaction.aggregate([
    {
      $match: {
        customerId: customerId,
        $or: [
          { type: 'payment' },
          { type: 'advance', paymentMethod: 'advance' }
        ],
        status: { $in: ['completed', 'paid'] }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' }
      }
    }
  ]);

  let totalPaid = totalPayments.length > 0 ? totalPayments[0].total : 0;
  let remainingPayment = totalPaid;

  // Evaluate each invoice in FIFO order
  for (const invoice of allInvoices) {
    const previousStatus = invoice.status;
    const previousPaidAmount = invoice.paidAmount || 0;
    
    if (remainingPayment >= invoice.amount) {
      invoice.status = 'completed';
      invoice.paidAmount = invoice.amount;
      remainingPayment -= invoice.amount;
    } else if (remainingPayment > 0.01) { // Account for small rounding errors
      invoice.status = 'partial';
      invoice.paidAmount = remainingPayment;
      remainingPayment = 0;
    } else {
      invoice.status = 'pending';
      invoice.paidAmount = 0;
    }
    
    if (invoice.status !== previousStatus || invoice.paidAmount !== previousPaidAmount) {
      await invoice.save();
    }
  }
}

// Helper function to recalculate customer balance from all transactions
const recalculateCustomerBalance = async (customerId) => {
  const customer = await Customer.findById(customerId);
  if (!customer) return;

  // Get all transactions for this customer
  const transactions = await Transaction.find({
    customerId: customerId
  });

  // Reset balances
  let totalCredit = 0;
  let totalPaid = 0; // Money applied to invoices (regular payments + advance usages)
  let totalAdvanceReceipts = 0;
  let totalAdvanceUsages = 0;
  let totalRegularPayments = 0;

  // Calculate totals from transactions
  for (const transaction of transactions) {
    const normalizedStatus = (transaction.status || '').toLowerCase();
    const isCompleted = ['completed', 'paid'].includes(normalizedStatus);

    if (transaction.type === 'invoice') {
      // All invoices count towards total credit (Sales)
      if (!['failed', 'cancelled'].includes(normalizedStatus)) {
        totalCredit += transaction.amount;
      }
    } else if (transaction.type === 'payment') {
      if (isCompleted) {
        if (transaction.paymentMethod === 'advance' || transaction.paymentMethod === 'FROM_ADVANCE') {
          totalAdvanceUsages += transaction.amount;
          totalPaid += transaction.amount;
        } else {
          totalRegularPayments += transaction.amount;
          totalPaid += transaction.amount;
        }
      }
    } else if (transaction.type === 'advance') {
      if (isCompleted) {
        if (transaction.paymentMethod === 'advance') {
          totalAdvanceUsages += transaction.amount;
          totalPaid += transaction.amount;
        } else {
          totalAdvanceReceipts += transaction.amount;
        }
      }
    }
  }

  // Update customer with recalculated values
  customer.totalCredit = totalCredit;
  customer.totalPaid = totalPaid;
  customer.balance = Math.max(0, totalCredit - totalPaid);

  // Calculate advance payment
  // 1. Remaining from direct advance receipts (receipts - usages)
  const remainingAdvanceFromReceipts = Math.max(0, totalAdvanceReceipts - totalAdvanceUsages);
  
  // 2. Overpayment from regular payments (extra amount after covering what advance usages didn't)
  const neededFromRegularPayments = Math.max(0, totalCredit - totalAdvanceUsages);
  const overpaymentFromPayments = Math.max(0, totalRegularPayments - neededFromRegularPayments);
  
  customer.advancePayment = remainingAdvanceFromReceipts + overpaymentFromPayments;

  // Ensure balance doesn't go below 0 due to rounding errors
  if (customer.balance < 0.01) {
    customer.balance = 0;
  }
  
  if (customer.advancePayment < 0.01) {
    customer.advancePayment = 0;
  }

  await customer.save();
  return customer;
}

exports.recalculateCustomerBalance = recalculateCustomerBalance;

// @desc    Get transactions by customer ID
// @route   GET /api/v1/transactions/customer/:customerId
// @access  Public
exports.getCustomerTransactions = async (req, res, next) => {
  try {
    const transactions = await Transaction.find({ customerId: req.params.customerId })
      .sort({ date: -1, createdAt: -1 })
      .populate('customerId', 'name')
      .populate({
        path: 'items.productId',
        model: 'Product',
        select: 'name description sku category price'
      });

    res.status(200).json({
      success: true,
      count: transactions.length,
      data: transactions
    });
  } catch (err) {
    next(err);
  }
};

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
      .sort({ date: -1, createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
      .populate('customerId', 'name')
      .populate({
        path: 'items.productId',
        model: 'Product',
        select: 'name description sku category price'
      });
    
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
      .populate('customerId', 'name')
      .populate({
        path: 'items.productId',
        model: 'Product',
        select: 'name description sku category price'
      });
    
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
    
    // Check if using advance payment
    let useAdvance = req.body.useAdvance || req.body.useAdvancePayment;
    let advanceAmountUsed = 0;
    let advancePaymentTransaction = null;
    
    // Determine invoice status if using advance payment
    let invoiceStatus = req.body.status || 'pending';
    if (req.body.type === 'invoice' && useAdvance && customer.advancePayment > 0) {
      advanceAmountUsed = Math.min(customer.advancePayment, req.body.amount);
      // If advance covers full amount, mark as completed from the start
      if (advanceAmountUsed >= req.body.amount) {
        invoiceStatus = 'completed';
      } else if (advanceAmountUsed > 0) {
        invoiceStatus = 'partial';
      }
    }
    
    // Create main transaction (invoice or payment)
    let transaction = await Transaction.create({
      ...req.body,
      customerName: customer.name,
      status: invoiceStatus
    });
    
    // Populate transaction items with product details
    transaction = await Transaction.findById(transaction._id).populate({
      path: 'items.productId',
      model: 'Product',
      select: 'name description sku category price'
    });
    
    // Update customer balance based on transaction type
    if (req.body.type === 'payment' && req.body.status === 'completed') {
      // If payment is from advance, deduct from customer's advance balance
      if (req.body.paymentMethod === 'advance' || req.body.paymentMethod === 'FROM_ADVANCE') {
        // Find the original advance transaction
        const lastAdvance = await Transaction.findOne({
          customerId: customer._id,
          type: 'advance',
          status: 'completed'
        }).sort({ date: -1, createdAt: -1 });

        // Ensure we don't deduct more than available, but the frontend should handle this
        const deductAmount = Math.min(customer.advancePayment, req.body.amount);
        const originalAdvanceAmount = lastAdvance ? lastAdvance.amount : deductAmount;
        
        customer.advancePayment -= deductAmount;
        await customer.save();
        
        // Ensure paymentMethod is stored as 'advance' for consistency in recalculation
        transaction.paymentMethod = 'advance';
        
        // Populate advance fields
        if (lastAdvance) {
          transaction.advanceTransactionId = lastAdvance._id;
          transaction.advanceOriginalAmount = lastAdvance.amount;
        } else {
          transaction.advanceOriginalAmount = deductAmount + customer.advancePayment; // Fallback
        }
        
        transaction.advanceUsedAmount = deductAmount;
        transaction.advanceRemainingAfterUse = customer.advancePayment;
        transaction.description = `Paid from exact advance amount: ₹${(customer.advancePayment + deductAmount).toFixed(2)}`;
        
        await transaction.save();
      }

      // Mark invoices as completed if they're fully paid
      await updateInvoiceStatusIfPaid(customer._id);
      
      // Regular payment transaction - recalculate from scratch
      await recalculateCustomerBalance(customer._id);
      
      // Get updated customer
      const updatedCustomer = await Customer.findById(customer._id);
      
      res.status(201).json({
        success: true,
        data: transaction,
        customerBalance: updatedCustomer.balance,
        customerAdvanceBalance: updatedCustomer.advancePayment
      });
    } else if (req.body.type === 'invoice') {
      // Deduct inventory for items in the invoice
      if (req.body.items && Array.isArray(req.body.items)) {
        try {
          await deductInventoryOnSale(req.body.items, transaction._id);
        } catch (inventoryError) {
          // If inventory deduction fails, delete the created transaction and return error
          await Transaction.findByIdAndDelete(transaction._id);
          return res.status(400).json({
            success: false,
            error: inventoryError.message
          });
        }
      }
      
      // Check if we should use advance payment
      if (useAdvance && customer.advancePayment > 0) {
        // Find the original advance transaction
        const lastAdvance = await Transaction.findOne({
          customerId: customer._id,
          type: 'advance',
          status: 'completed'
        }).sort({ date: -1, createdAt: -1 });

        // Deduct from customer advance payment
        customer.advancePayment -= advanceAmountUsed;
        await customer.save();
        
        // Create a payment transaction for the advance amount used
        advancePaymentTransaction = await Transaction.create({
          customerId: customer._id,
          customerName: customer.name,
          type: 'payment',
          amount: advanceAmountUsed,
          status: 'completed',
          description: `Paid from exact advance amount: ₹${(customer.advancePayment + advanceAmountUsed).toFixed(2)}`,
          reference: `ADV-${transaction.reference || transaction._id}`,
          date: transaction.date,
          paymentMethod: 'advance', // Mark this as an advance payment transaction
          advanceTransactionId: lastAdvance ? lastAdvance._id : undefined,
          advanceOriginalAmount: lastAdvance ? lastAdvance.amount : (advanceAmountUsed + customer.advancePayment),
          advanceUsedAmount: advanceAmountUsed,
          advanceRemainingAfterUse: customer.advancePayment
        });
        
        // Update invoice description and mark that advance was used
        transaction.description = transaction.description ? 
          `${transaction.description} (₹${advanceAmountUsed} paid from advance)` : 
          `₹${advanceAmountUsed} paid from advance payment`;
        transaction.paymentMethod = 'advance'; // Mark invoice as paid by advance
        await transaction.save();
      }
      
      // Update invoice status and paidAmount based on all payments
      await updateInvoiceStatusIfPaid(customer._id);
      
      // Recalculate customer balance from all transactions
      await recalculateCustomerBalance(customer._id);
      
      // Get updated customer with fresh data
      const updatedCustomer = await Customer.findById(customer._id);
      
      res.status(201).json({
        success: true,
        data: transaction,
        advancePaymentUsed: advanceAmountUsed,
        advancePaymentTransaction: advancePaymentTransaction,
        customerBalance: updatedCustomer.balance,
        customerAdvanceBalance: updatedCustomer.advancePayment
      });
    } else {
      res.status(201).json({
        success: true,
        data: transaction
      });
    }
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
    
    // If status or amount or type is changing, update customer balance and invoice statuses
    const isStatusChanging = req.body.status && req.body.status !== transaction.status;
    const isAmountChanging = req.body.amount && req.body.amount !== transaction.amount;
    const isTypeChanging = req.body.type && req.body.type !== transaction.type;

    if (isStatusChanging || isAmountChanging || isTypeChanging) {
      // Update the transaction first
      transaction = await Transaction.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      ).populate({
        path: 'items.productId',
        model: 'Product',
        select: 'name description sku category price'
      });
      
      // Mark invoices as completed/partial/pending based on remaining payments
      await updateInvoiceStatusIfPaid(transaction.customerId);
      
      // Then recalculate customer balance from all transactions
      await recalculateCustomerBalance(transaction.customerId);
    } else {
      // If status is not changing, just update normally
      transaction = await Transaction.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      ).populate({
        path: 'items.productId',
        model: 'Product',
        select: 'name description sku category price'
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
    
    const customerId = transaction.customerId;
    
    // Restore inventory if this was an invoice with items
    if (transaction.type === 'invoice' && transaction.items && transaction.items.length > 0) {
      await restoreInventoryOnDeletion(transaction.items, transaction._id);
    }
    
    // Delete the transaction
    await transaction.deleteOne();
    
    // Mark invoices as completed/partial/pending based on remaining payments
    await updateInvoiceStatusIfPaid(customerId);
    
    // Recalculate customer balance from scratch based on remaining transactions
    await recalculateCustomerBalance(customerId);
    
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

    // Get transactions to identify affected customers
    const transactions = await Transaction.find({ _id: { $in: ids } });
    
    // Get unique customer IDs
    const customerIds = [...new Set(transactions.map(t => t.customerId.toString()))];

    // Restore inventory for each invoice being deleted
    for (const transaction of transactions) {
      if (transaction.type === 'invoice' && transaction.items && transaction.items.length > 0) {
        await restoreInventoryOnDeletion(transaction.items, transaction._id);
      }
    }

    // Delete transactions
    const result = await Transaction.deleteMany({ _id: { $in: ids } });
    
    // Recalculate balance for each affected customer
    for (const customerId of customerIds) {
      await updateInvoiceStatusIfPaid(customerId);
      await recalculateCustomerBalance(customerId);
    }
    
    res.status(200).json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Successfully deleted ${result.deletedCount} transaction(s)`
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Apply advance payment deduction to invoice
// @route   POST /api/v1/transactions/advance-deduction
// @access  Public
exports.applyAdvanceDeduction = async (req, res, next) => {
  try {
    const { transactionId, amount } = req.body;
    
    // Validate input
    if (!transactionId || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Transaction ID and amount are required'
      });
    }
    
    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be greater than zero'
      });
    }
    
    // Find the invoice transaction
    const invoice = await Transaction.findById(transactionId);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }
    
    if (invoice.type !== 'invoice') {
      return res.status(400).json({
        success: false,
        error: 'Advance payment can only be applied to invoice transactions'
      });
    }
    
    // Get customer
    const customer = await Customer.findById(invoice.customerId);
    
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }
    
    // Check if customer has enough advance payment
    if (customer.advancePayment <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Customer has no advance payment available'
      });
    }
    
    // Calculate the deduction amount (cannot exceed advance payment or requested amount)
    const deductionAmount = Math.min(customer.advancePayment, amount);
    
    // Find the original advance transaction (receipt)
    const lastAdvance = await Transaction.findOne({
      customerId: customer._id,
      type: 'advance',
      status: 'completed',
      paymentMethod: { $ne: 'advance' } // Exclude deduction records
    }).sort({ date: -1, createdAt: -1 });

    // Deduct from advance payment
    customer.advancePayment -= deductionAmount;
    await customer.save();
    
    // Create a transaction record for the advance deduction
    await Transaction.create({
      customerId: customer._id,
      customerName: customer.name,
      type: 'advance',
      amount: deductionAmount,
      status: 'completed',
      description: `Paid from exact advance amount: ₹${(customer.advancePayment + deductionAmount).toFixed(2)}`,
      reference: `ADV-${invoice.reference || invoice._id}`,
      date: new Date(),
      paymentMethod: 'advance', // Added to avoid double counting in recalculateCustomerBalance
      advanceTransactionId: lastAdvance ? lastAdvance._id : undefined,
      advanceOriginalAmount: lastAdvance ? lastAdvance.amount : (deductionAmount + customer.advancePayment),
      advanceUsedAmount: deductionAmount,
      advanceRemainingAfterUse: customer.advancePayment
    });
    
    // Recalculate customer balance from all transactions (this will also update invoice status if needed)
    await updateInvoiceStatusIfPaid(customer._id);
    const updatedCustomer = await recalculateCustomerBalance(customer._id);
    
    // Refresh invoice to get updated status
    const updatedInvoice = await Transaction.findById(transactionId);
    
    res.status(200).json({
      success: true,
      data: {
        deductionAmount,
        remainingAdvancePayment: updatedCustomer.advancePayment,
        remainingBalance: updatedCustomer.balance,
        invoiceStatus: updatedInvoice.status,
        transaction: updatedInvoice // Return the updated invoice
      },
      message: `Successfully deducted ${deductionAmount} from advance payment`
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
    
    // Get pending or partial invoices that are due soon or overdue
    const pendingInvoices = await Transaction.find({
      type: 'invoice',
      status: { $in: ['pending', 'partial'] },
      $or: [
        { dueDate: { $lte: sevenDaysFromNow } }, // Due within 7 days
        { dueDate: { $lt: now } } // Overdue
      ]
    })
    .populate('customerId', 'name phone balance totalCredit totalPaid')
    .sort({ dueDate: 1 });
    
    const alerts = pendingInvoices
      .filter(transaction => {
        // Filter out invoices where customer balance is 0 or less
        const customerBalance = transaction.customerId?.balance || 0;
        return customerBalance > 0.01; // Use 0.01 to account for rounding errors
      })
      .map(transaction => {
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
