const mongoose = require('mongoose');

const PaymentAllocationSchema = new mongoose.Schema({
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: [true, 'Please add a payment ID']
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
    required: [true, 'Please add an invoice ID']
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Please add a customer ID']
  },
  allocatedAmount: {
    type: Number,
    required: [true, 'Please add an allocated amount']
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('PaymentAllocation', PaymentAllocationSchema);
