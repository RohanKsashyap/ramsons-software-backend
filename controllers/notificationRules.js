const NotificationRule = require('../models/NotificationRule');

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