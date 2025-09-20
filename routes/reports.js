const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Customer = require('../models/Customer');

// Generate sales report
router.post('/sales', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    // Fetch transactions directly from database
    const transactions = await Transaction.find({
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      type: 'SALE'
    }).populate('customer', 'name phone');

    const salesData = transactions.reduce((acc, t) => {
      acc.totalSales += parseFloat(t.amount || 0);
      acc.totalPaid += parseFloat(t.paidAmount || 0);
      acc.totalOutstanding += parseFloat(t.remainingAmount || 0);
      return acc;
    }, { totalSales: 0, totalPaid: 0, totalOutstanding: 0 });

    res.json({
      period: { startDate, endDate },
      transactions,
      summary: salesData,
    });
  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate overdue report
router.get('/overdue', async (req, res) => {
  try {
    // Fetch overdue transactions directly from database
    const transactions = await Transaction.find({
      status: { $in: ['UNPAID', 'PARTIAL'] },
      remainingAmount: { $gt: 0 }
    }).populate('customer', 'name phone');

    const summary = transactions.reduce((acc, t) => {
      acc.totalOverdue += parseFloat(t.remainingAmount || 0);
      acc.count += 1;
      return acc;
    }, { totalOverdue: 0, count: 0 });

    res.json({
      transactions,
      summary,
      generatedAt: new Date(),
    });
  } catch (error) {
    console.error('Overdue report error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate customer report
router.get('/customers', async (req, res) => {
  try {
    // Fetch customers directly from database
    const customers = await Customer.find({});
    
    const customerSummary = customers.reduce((acc, customer) => {
      acc.totalCustomers += 1;
      acc.totalCredit += parseFloat(customer.totalCredit || 0);
      acc.totalPaid += parseFloat(customer.totalPaid || 0);
      acc.totalOutstanding += parseFloat(customer.balance || 0);
      
      if (parseFloat(customer.balance || 0) > 0) {
        acc.customersWithBalance += 1;
      }
      
      return acc;
    }, { 
      totalCustomers: 0, 
      totalCredit: 0, 
      totalPaid: 0, 
      totalOutstanding: 0,
      customersWithBalance: 0 
    });

    res.json({
      customers,
      summary: customerSummary,
      generatedAt: new Date(),
    });
  } catch (error) {
    console.error('Customer report error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generate payment report
router.post('/payments', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    // Fetch payment transactions directly from database
    const transactions = await Transaction.find({
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      },
      type: 'PAYMENT'
    }).populate('customer', 'name phone');

    const paymentData = transactions.reduce((acc, t) => {
      acc.totalPayments += parseFloat(t.amount || 0);
      acc.count += 1;
      return acc;
    }, { totalPayments: 0, count: 0 });

    res.json({
      period: { startDate, endDate },
      transactions,
      summary: paymentData,
    });
  } catch (error) {
    console.error('Payment report error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export to Excel (placeholder)
router.post('/export/excel', async (req, res) => {
  try {
    const { filename } = req.body;
    res.json({ 
      filePath: `C:/Users/${process.env.USERNAME}/Downloads/${filename}.xlsx`,
      success: true 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export to PDF (placeholder)
router.post('/export/pdf', async (req, res) => {
  try {
    const { filename } = req.body;
    res.json({ 
      filePath: `C:/Users/${process.env.USERNAME}/Downloads/${filename}.pdf`,
      success: true 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
