const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Please add a customer ID']
  },
  customerName: {
    type: String,
    required: [true, 'Please add a customer name']
  },
  type: {
    type: String,
    required: [true, 'Please add a transaction type'],
    enum: ['payment', 'invoice', 'customer', 'credit', 'debit']
  },
  amount: {
    type: Number,
    required: [true, 'Please add an amount']
  },
  date: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    required: [true, 'Please add a status'],
    enum: ['pending', 'completed', 'failed', 'cancelled']
  },
  description: {
    type: String,
    trim: true
  },
  reference: {
    type: String,
    trim: true
  },
  paymentMethod: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Transaction', TransactionSchema);