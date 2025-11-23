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
    
    // Get total revenue (sum of completed invoices - actual sales made)
    const revenueResult = await Transaction.aggregate([
      { $match: { type: 'invoice', status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;
    
    // Get total outstanding (sum of invoice transactions minus completed payments)
    const outstandingResult = await Customer.aggregate([
      { $group: { _id: null, total: { $sum: '$balance' } } }
    ]);
    const totalOutstanding = outstandingResult.length > 0 ? outstandingResult[0].total : 0;
    
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
    
    // Get overdue count (invoices that are past due date and still pending)
    const now = new Date();
    const overdueCount = await Transaction.countDocuments({
      type: 'invoice',
      status: 'pending',
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
        totalOutstanding,
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
    
    // Get monthly revenue for current year (completed invoices)
    const monthlyRevenue = await Transaction.aggregate([
      {
        $match: {
          type: 'invoice',
          status: 'completed',
          date: {
            $gte: new Date(`${currentYear}-01-01`),
            $lte: new Date(`${currentYear}-12-31`)
          }
        }
      },
      {
        $group: {
          _id: { $month: "$date" },
          total: { $sum: "$amount" }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Format monthly revenue for frontend
    const formattedMonthlyRevenue = Array(12).fill(0);
    monthlyRevenue.forEach(item => {
      formattedMonthlyRevenue[item._id - 1] = item.total;
    });
    
    res.json({
      success: true,
      data: formattedMonthlyRevenue
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};