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
    enum: ['payment', 'invoice', 'customer', 'credit', 'debit', 'advance']
  },
  amount: {
    type: Number,
    required: [true, 'Please add an amount']
  },
  date: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date,
    // For invoice type transactions, due date will be required
    validate: {
      validator: function(v) {
        // Only require due date for invoice type transactions
        return this.type !== 'invoice' || v != null;
      },
      message: 'Due date is required for invoices'
    }
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
  },
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    quantity: {
      type: Number,
      required: true
    },
    pricePerUnit: {
      type: Number,
      required: true
    },
    total: {
      type: Number,
      required: true
    }
  }],
  originalAmount: {
    type: Number
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Transaction', TransactionSchema);
