const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Please add a customer ID']
  },
  invoiceNumber: {
    type: String,
    required: [true, 'Please add an invoice number'],
    unique: true
  },
  totalAmount: {
    type: Number,
    required: [true, 'Please add a total amount']
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  pendingAmount: {
    type: Number,
    default: function() {
      return this.totalAmount;
    }
  },
  status: {
    type: String,
    enum: ['unpaid', 'partial', 'paid'],
    default: 'unpaid'
  },
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    productName: String,
    quantity: Number,
    pricePerUnit: Number,
    total: Number
  }],
  date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Invoice', InvoiceSchema);
