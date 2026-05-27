const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');


/**
 * @desc    Get dashboard statistics
 * @route   GET /api/v1/dashboard/stats
 * @access  Public
 */
exports.getDashboardStats = async (req, res) => {
  try {
    // Get total customers count
    const totalCustomers = await Customer.countDocuments();
    
    // Get total transactions count
    const totalTransactions = await Transaction.countDocuments();
    
    // Get total revenue (sum of all completed payments, excluding advance receipts and usage)
    const revenueResult = await Transaction.aggregate([
      { 
        $match: { 
          type: 'payment', 
          status: { $in: ['completed', 'paid'] },
          paymentMethod: { $ne: 'advance' } // Exclude advance usage/deductions to avoid double counting
        } 
      },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    // Get total sales (sum of all paidAmount from invoices - only actual received payments)
    const salesResult = await Transaction.aggregate([
      { 
        $match: { 
          type: 'invoice', 
          status: { $nin: ['failed', 'cancelled'] } 
        } 
      },
      { $group: { _id: null, total: { $sum: '$paidAmount' } } }
    ]);
    const totalSales = salesResult.length > 0 ? salesResult[0].total : 0;
    
    // Get total outstanding (sum of all pendingAmount from active invoices)
    const outstandingResult = await Transaction.aggregate([
      { 
        $match: { 
          type: 'invoice', 
          status: { $nin: ['failed', 'cancelled'] },
          pendingAmount: { $gt: 0 }
        } 
      },
      { $group: { _id: null, total: { $sum: '$pendingAmount' } } }
    ]);
    const totalOutstanding = outstandingResult.length > 0 ? outstandingResult[0].total : 0;

    // Get total advance (sum of advancePayment from all customers)
    const advanceResult = await Customer.aggregate([
      { $match: { advancePayment: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: '$advancePayment' } } }
    ]);
    const totalAdvance = advanceResult.length > 0 ? advanceResult[0].total : 0;
    
    // Get recent transactions
    const recentTransactions = await Transaction.find()
      .sort({ date: -1 })
      .limit(5)
      .populate('customerId', 'name')
      .populate({
        path: 'items.productId',
        model: 'Product',
        select: 'name description sku category price'
      });
    
    // Get overdue count (invoices that are past due date and still pending or partial)
    const now = new Date();
    const overdueCount = await Transaction.countDocuments({
      type: 'invoice',
      status: { $in: ['pending', 'partial'] },
      dueDate: { $lt: now }
    });

    // Get customer distribution by balance range
    const customerDistribution = await Customer.aggregate([
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $lte: ["$balance", 0] }, then: "Paid" },
                { case: { $and: [{ $gt: ["$balance", 0] }, { $lte: ["$balance", 1000] }] }, then: "0-1000" },
                { case: { $and: [{ $gt: ["$balance", 1000] }, { $lte: ["$balance", 5000] }] }, then: "1000-5000" },
                { case: { $gt: ["$balance", 5000] }, then: "5000+" }
              ],
              default: "Unknown"
            }
          },
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Format customer distribution for frontend
    const formattedDistribution = {};
    customerDistribution.forEach(item => {
      formattedDistribution[item._id] = item.count;
    });
    
    res.json({
      success: true,
      data: {
        totalCustomers,
        totalTransactions,
        totalRevenue,
        totalSales,
        totalOutstanding,
        totalAdvance,
        overdueCount,
        recentTransactions,
        customerDistribution: formattedDistribution
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

/**
 * @desc    Get monthly revenue data
 * @route   GET /api/v1/dashboard/monthly-revenue
 * @access  Public
 */
exports.getMonthlyRevenue = async (req, res) => {
  try {
    // Get current year
    const currentYear = new Date().getFullYear();
    
    // Get monthly sales for current year (sum of paidAmount - only actual received payments)
    const monthlySales = await Transaction.aggregate([
      {
        $match: {
          type: 'invoice',
          status: { $nin: ['failed', 'cancelled'] },
          date: {
            $gte: new Date(currentYear, 0, 1),
            $lte: new Date(currentYear, 11, 31, 23, 59, 59)
          }
        }
      },
      {
        $group: {
          _id: { $month: "$date" },
          total: { $sum: "$paidAmount" }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Format monthly sales for frontend
    const formattedMonthlySales = Array(12).fill(0);
    monthlySales.forEach(item => {
      formattedMonthlySales[item._id - 1] = item.total;
    });
    
    res.json({
      success: true,
      data: formattedMonthlySales
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};