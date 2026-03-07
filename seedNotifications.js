const NotificationRule = require('./models/NotificationRule');
const mongoose = require('mongoose');
require('dotenv').config();

const defaultNotificationRules = [
  {
    name: 'Overdue Payment Alert',
    triggerType: 'payment_overdue',
    conditions: {
      daysOverdue: 1,
      balanceThreshold: 0
    },
    actions: {
      notification: true,
      email: false,
      sms: false
    },
    sound: {
      enabled: true,
      type: 'urgent',
      volume: 0.8
    },
    schedule: {
      frequency: 'daily',
      time: '09:00'
    },
    message: {
      title: 'Payment Overdue Alert',
      body: 'You have customers with overdue payments that need immediate attention.'
    },
    active: true
  },
  {
    name: 'Payment Due Today',
    triggerType: 'due_date_reminder',
    conditions: {
      daysBeforeDue: 0,
      balanceThreshold: 0
    },
    actions: {
      notification: true,
      email: false,
      sms: false
    },
    sound: {
      enabled: true,
      type: 'urgent',
      volume: 0.7
    },
    schedule: {
      frequency: 'daily',
      time: '10:00'
    },
    message: {
      title: 'Payment Due Today',
      body: 'You have payments due today that require your attention.'
    },
    active: true
  },
  {
    name: 'Payment Due in 3 Days',
    triggerType: 'due_date_reminder',
    conditions: {
      daysBeforeDue: 3,
      balanceThreshold: 0
    },
    actions: {
      notification: true,
      email: false,
      sms: false
    },
    sound: {
      enabled: true,
      type: 'reminder',
      volume: 0.6
    },
    schedule: {
      frequency: 'daily',
      time: '11:00'
    },
    message: {
      title: 'Payment Due Soon',
      body: 'You have payments due in the next few days.'
    },
    active: true
  },
  {
    name: 'Payment Due in 7 Days',
    triggerType: 'due_date_reminder',
    conditions: {
      daysBeforeDue: 7,
      balanceThreshold: 100
    },
    actions: {
      notification: true,
      email: false,
      sms: false
    },
    sound: {
      enabled: true,
      type: 'notification',
      volume: 0.5
    },
    schedule: {
      frequency: 'daily',
      time: '12:00'
    },
    message: {
      title: 'Upcoming Payment Reminder',
      body: 'You have payments coming up in a week.'
    },
    active: true
  }
];

async function seedNotifications() {
  try {
    console.log('Connecting to database...');

    // Connect to MongoDB
    const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/ramsons-accounting';
    await mongoose.connect(mongoURI);

    console.log('Seeding notification rules...');

    // Clear existing rules
    await NotificationRule.deleteMany({});
    console.log('Cleared existing notification rules');

    // Create default rules
    for (const ruleData of defaultNotificationRules) {
      const rule = new NotificationRule(ruleData);
      await rule.save();
      console.log(`Created notification rule: ${ruleData.name}`);
    }

    console.log('Notification rules seeded successfully!');
    console.log('Available rules:');
    defaultNotificationRules.forEach(rule => {
      console.log(`- ${rule.name} (${rule.triggerType})`);
    });

  } catch (error) {
    console.error('Error seeding notification rules:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed');
  }
}

// Run if called directly
if (require.main === module) {
  seedNotifications().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
}

module.exports = { seedNotifications, defaultNotificationRules };