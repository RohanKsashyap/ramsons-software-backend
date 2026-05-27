const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Please add a customer ID']
  },
  paymentNumber: {
    type: String,
    required: [true, 'Please add a payment number'],
    unique: true
  },
  amount: {
    type: Number,
    required: [true, 'Please add an amount']
  },
  remainingAmount: {
    type: Number,
    default: function() {
      return this.amount;
    }
  },
  paymentMethod: {
    type: String,
    required: [true, 'Please add a payment method']
  },
  notes: {
    type: String,
    trim: true
  },
  date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Payment', PaymentSchema);
