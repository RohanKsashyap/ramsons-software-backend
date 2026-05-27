const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const PaymentAllocation = require('../models/PaymentAllocation');
const Customer = require('../models/Customer');

/**
 * Allocate payments to invoices using FIFO method
 * @param {String} customerId 
 */
const allocatePayments = async (customerId) => {
  // Get all unpaid or partially paid invoices sorted by date
  const invoices = await Invoice.find({
    customerId,
    status: { $in: ['unpaid', 'partial'] }
  }).sort({ date: 1, createdAt: 1 });

  // Get all payments with remaining amount > 0 sorted by date
  const payments = await Payment.find({
    customerId,
    remainingAmount: { $gt: 0 }
  }).sort({ date: 1, createdAt: 1 });

  for (const payment of payments) {
    for (const invoice of invoices) {
      if (payment.remainingAmount <= 0) break;
      if (invoice.status === 'paid') continue;

      const amountToAllocate = Math.min(payment.remainingAmount, invoice.pendingAmount);

      if (amountToAllocate > 0) {
        // Create allocation
        await PaymentAllocation.create({
          paymentId: payment._id,
          invoiceId: invoice._id,
          customerId,
          allocatedAmount: amountToAllocate
        });

        // Update payment
        payment.remainingAmount -= amountToAllocate;
        
        // Update invoice
        invoice.paidAmount += amountToAllocate;
        invoice.pendingAmount -= amountToAllocate;
        
        if (invoice.pendingAmount <= 0) {
          invoice.status = 'paid';
        } else if (invoice.paidAmount > 0) {
          invoice.status = 'partial';
        }
      }
    }
    await payment.save();
  }

  // Save all modified invoices
  for (const invoice of invoices) {
    if (invoice.isModified()) {
      await invoice.save();
    }
  }
};

/**
 * Recalculate customer totals
 * @param {String} customerId 
 */
const recalculateCustomerTotals = async (customerId) => {
  const invoices = await Invoice.find({ customerId });
  const payments = await Payment.find({ customerId });

  let totalInvoiceAmount = 0;
  let totalPaid = 0;
  let totalPending = 0;
  let advanceBalance = 0;

  invoices.forEach(inv => {
    totalInvoiceAmount += inv.totalAmount;
    totalPending += inv.pendingAmount;
  });

  payments.forEach(pay => {
    totalPaid += (pay.amount - pay.remainingAmount);
    advanceBalance += pay.remainingAmount;
  });

  const customer = await Customer.findById(customerId);
  if (customer) {
    customer.totalCredit = totalInvoiceAmount;
    customer.totalPaid = totalPaid;
    customer.balance = totalPending;
    customer.advancePayment = advanceBalance;
    await customer.save();
  }

  return {
    totalInvoiceAmount,
    totalPaid,
    totalPending,
    advanceBalance
  };
};

/**
 * Completely reset allocations for a customer and re-run FIFO
 * @param {String} customerId 
 */
const resetAndReallocate = async (customerId) => {
  // Delete all allocations
  await PaymentAllocation.deleteMany({ customerId });

  // Reset all invoices
  const invoices = await Invoice.find({ customerId });
  for (const inv of invoices) {
    inv.paidAmount = 0;
    inv.pendingAmount = inv.totalAmount;
    inv.status = 'unpaid';
    await inv.save();
  }

  // Reset all payments
  const payments = await Payment.find({ customerId });
  for (const pay of payments) {
    pay.remainingAmount = pay.amount;
    await pay.save();
  }

  // Re-run allocation
  await allocatePayments(customerId);
  
  // Recalculate customer totals
  await recalculateCustomerTotals(customerId);
};

module.exports = {
  allocatePayments,
  recalculateCustomerTotals,
  resetAndReallocate
};
