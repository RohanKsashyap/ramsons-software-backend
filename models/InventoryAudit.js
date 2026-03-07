const mongoose = require('mongoose');

const InventoryAuditSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Please add a product ID']
  },
  productName: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: [true, 'Please add an audit type'],
    enum: ['add', 'adjustment', 'sale', 'return']
  },
  quantityChange: {
    type: Number,
    required: [true, 'Please add a quantity change']
  },
  previousQuantity: {
    type: Number,
    required: true
  },
  newQuantity: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    trim: true
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  performedBy: {
    type: String,
    default: 'system'
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

module.exports = mongoose.model('InventoryAudit', InventoryAuditSchema);
