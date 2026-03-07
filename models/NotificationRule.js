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
    enum: ['invoice_created', 'payment_due', 'payment_overdue', 'payment_received', 'due_date_reminder']
  },
  conditions: {
    type: Object,
    default: {},
    daysBeforeDue: {
      type: Number,
      default: 1
    },
    daysOverdue: {
      type: Number,
      default: undefined
    },
    balanceThreshold: {
      type: Number,
      default: undefined
    },
    customerTags: {
      type: [String],
      default: undefined
    }
  },
  actions: {
    notification: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
    sms: { type: Boolean, default: false }
  },
  sound: {
    enabled: {
      type: Boolean,
      default: true
    },
    type: {
      type: String,
      enum: ['notification', 'urgent', 'reminder', 'custom'],
      default: 'notification'
    },
    customUrl: {
      type: String,
      default: ''
    },
    volume: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.7
    }
  },
  schedule: {
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'daily' },
    time: { type: String, default: '09:00' },
    days: { type: [Number], default: undefined } // 0-6 for weekly
  },
  message: {
    title: { type: String, default: '' },
    body: { type: String, default: '' }
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
