const NotificationRule = require('../models/NotificationRule');
const Transaction = require('../models/Transaction');
const mongoose = require('mongoose');

/**
 * @desc    Get all notification rules
 * @route   GET /api/v1/notification-rules
 * @access  Public
 */
exports.getNotificationRules = async (req, res) => {
  try {
    const notificationRules = await NotificationRule.find();
    
    res.json({
      success: true,
      count: notificationRules.length,
      data: notificationRules
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

/**
 * @desc    Test a notification rule
 * @route   POST /api/v1/notification-rules/:id/test
 * @access  Public
 */
exports.testNotificationRule = async (req, res) => {
  try {
    const ruleId = req.params.id;
    const notificationRule = await NotificationRule.findById(ruleId);
    if (!notificationRule) {
      return res.status(404).json({ success: false, error: 'Notification rule not found' });
    }

    // Simulate testing the notification rule
    // For example, you could trigger a test notification or validate the rule logic here
    // This is a placeholder response for demonstration
    res.json({
      success: true,
      message: `Test notification for rule ${ruleId} executed successfully`
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

/**
 * @desc    Check for due date notifications
 * @route   GET /api/v1/notification-rules/check-due-dates
 * @access  Public
 */
exports.checkDueDateNotifications = async (req, res) => {
  try {
    // Find all active notification rules for due date reminders
    const rules = await NotificationRule.find({
      triggerType: 'due_date_reminder',
      active: true
    });

    // If called without res (e.g., from cron), return payload instead of res.json
    if (rules.length === 0) {
      const payload = {
        success: true,
        data: [],
        message: 'No active due date reminder rules found'
      };
      if (res) return res.json(payload);
      return payload;
    }

    // Get all pending invoices with a valid due date
    const pendingInvoices = await Transaction.find({
      type: 'invoice',
      status: 'pending',
      dueDate: { $exists: true, $ne: null }
    }).populate('customerId', 'name phone email balance');

    const notifications = [];

    // Process each rule
    for (const rule of rules) {
      const conditions = rule.conditions || {};
      const daysBeforeDue = Number.isFinite(conditions.daysBeforeDue)
        ? conditions.daysBeforeDue
        : (conditions.daysBeforeDue || 0);
      const balanceThreshold = Number.isFinite(conditions.balanceThreshold)
        ? conditions.balanceThreshold
        : (conditions.balanceThreshold || 0);

      // Calculate the target date (today + daysBeforeDue)
      const today = new Date();
      const targetDate = new Date();
      targetDate.setDate(today.getDate() + daysBeforeDue);

      // Compare only the date part (YYYY-MM-DD)
      const targetDateStr = targetDate.toISOString().split('T')[0];

      // Find invoices with due dates matching our target and meeting balance threshold
      const matchingInvoices = pendingInvoices.filter((invoice) => {
        if (!invoice.dueDate) return false;
        const dueDateStr = new Date(invoice.dueDate).toISOString().split('T')[0];
        const customer = invoice.customerId || {};
        const customerBalance = typeof customer.balance === 'number' ? customer.balance : 0;
        return dueDateStr === targetDateStr && customerBalance >= balanceThreshold;
      });

      // Create notifications for matching invoices
      for (const invoice of matchingInvoices) {
        const customer = invoice.customerId || {};
        notifications.push({
          rule: rule._id,
          invoice: invoice._id,
          customer: invoice.customerId,
          dueDate: invoice.dueDate,
          message: `Invoice #${invoice._id} for ${customer.name || invoice.customerName || 'Unknown Customer'} is due in ${daysBeforeDue} day${daysBeforeDue === 1 ? '' : 's'} and balance is $${typeof customer.balance === 'number' ? customer.balance : 0}`,
          created: new Date()
        });
      }
    }

    const payload = {
      success: true,
      count: notifications.length,
      data: notifications
    };
    if (res) return res.json(payload);
    return payload;
  } catch (err) {
    console.error(err.message);
    if (res) return res.status(500).json({ success: false, error: 'Server Error' });
    throw err;
  }
};

/**
 * @desc    Get single notification rule
 * @route   GET /api/v1/notification-rules/:id
 * @access  Public
 */
exports.getNotificationRule = async (req, res) => {
  try {
    const notificationRule = await NotificationRule.findById(req.params.id);
    
    if (!notificationRule) {
      return res.status(404).json({ success: false, error: 'Notification rule not found' });
    }
    
    res.json({
      success: true,
      data: notificationRule
    });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ success: false, error: 'Notification rule not found' });
    }
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

/**
 * @desc    Create a notification rule
 * @route   POST /api/v1/notification-rules
 * @access  Public
 */
exports.createNotificationRule = async (req, res) => {
  try {
    const newNotificationRule = new NotificationRule(req.body);
    const notificationRule = await newNotificationRule.save();
    
    res.status(201).json({
      success: true,
      data: notificationRule
    });
  } catch (err) {
    console.error(err.message);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({ success: false, error: messages });
    }
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

/**
 * @desc    Update a notification rule
 * @route   PUT /api/v1/notification-rules/:id
 * @access  Public
 */
exports.updateNotificationRule = async (req, res) => {
  try {
    const notificationRule = await NotificationRule.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    
    if (!notificationRule) {
      return res.status(404).json({ success: false, error: 'Notification rule not found' });
    }
    
    res.json({
      success: true,
      data: notificationRule
    });
  } catch (err) {
    console.error(err.message);
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({ success: false, error: messages });
    }
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ success: false, error: 'Notification rule not found' });
    }
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};

/**
 * @desc    Delete a notification rule
 * @route   DELETE /api/v1/notification-rules/:id
 * @access  Public
 */
exports.deleteNotificationRule = async (req, res) => {
  try {
    const notificationRule = await NotificationRule.findById(req.params.id);
    
    if (!notificationRule) {
      return res.status(404).json({ success: false, error: 'Notification rule not found' });
    }
    
    await notificationRule.deleteOne();
    
    res.json({
      success: true,
      data: {}
    });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ success: false, error: 'Notification rule not found' });
    }
    res.status(500).json({ success: false, error: 'Server Error' });
  }
};