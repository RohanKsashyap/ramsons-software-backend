const express = require('express');
const router = express.Router();
const { check, validationResult } = require('express-validator');
const {
  getNotificationRules,
  getNotificationRule,
  createNotificationRule,
  updateNotificationRule,
  deleteNotificationRule,
  checkDueDateNotifications,
  testNotificationRule
} = require('../controllers/notificationRules');

// Input validation middleware
const validateNotificationRuleInput = [
  check('name', 'Name is required').not().isEmpty(),
  check('triggerType', 'Trigger type is required').not().isEmpty(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
  }
];

// Notification rule routes
router.route('/')
  .get(getNotificationRules)
  .post(validateNotificationRuleInput, createNotificationRule);

router.route('/check-due-dates')
  .get(checkDueDateNotifications);

router.route('/:id')
  .get(getNotificationRule)
  .put(updateNotificationRule)
  .delete(deleteNotificationRule);

router.route('/:id/test')
  .post(testNotificationRule);

module.exports = router;