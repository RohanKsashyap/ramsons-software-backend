const mongoose = require('mongoose');

const FollowUpStepSchema = new mongoose.Schema({
  type: {
    type: String,
    required: [true, 'Please add a follow-up step type'],
    enum: ['email', 'sms', 'call']
  },
  delay: {
    type: Number,
    required: [true, 'Please add a delay in days'],
    min: 0
  },
  template: {
    type: String,
    required: [true, 'Please add a template']
  }
});

const FollowUpSequenceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true
  },
  steps: [FollowUpStepSchema]
});

const NotificationRuleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters']
  },
  triggerType: {
    type: String,
    required: [true, 'Please add a trigger type'],
    enum: ['invoice_created', 'payment_due', 'payment_overdue', 'payment_received']
  },
  conditions: {
    type: Object,
    default: {}
  },
  active: {
    type: Boolean,
    default: true
  },
  followUpSequence: FollowUpSequenceSchema
}, {
  timestamps: true
});

module.exports = mongoose.model('NotificationRule', NotificationRuleSchema);