const mongoose = require('mongoose');
const connectDB = require('./config/db');
const Customer = require('./models/Customer');
const Transaction = require('./models/Transaction');
const NotificationRule = require('./models/NotificationRule');

// Sample data
const customers = [
  {
    name: 'Acme Corp',
    phone: '555-123-4567',
    email: 'contact@acmecorp.com',
    address: '123 Business Ave, Suite 100, New York, NY 10001',
    totalCredit: 5000,
    totalPaid: 3500,
    balance: 1500
  },
  {
    name: 'XYZ Industries',
    phone: '555-987-6543',
    email: 'info@xyzindustries.com',
    address: '456 Corporate Blvd, Chicago, IL 60601',
    totalCredit: 7500,
    totalPaid: 4000,
    balance: 3500
  },
  {
    name: 'Global Enterprises',
    phone: '555-456-7890',
    email: 'sales@globalenterprises.com',
    address: '789 Market St, San Francisco, CA 94103',
    totalCredit: 10000,
    totalPaid: 8000,
    balance: 2000
  }
];

// Function to seed the database
const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Clear existing data
    await Customer.deleteMany({});
    await Transaction.deleteMany({});
    await NotificationRule.deleteMany({});
    
    console.log('Database cleared');
    
    // Insert customers
    const createdCustomers = await Customer.insertMany(customers);
    console.log(`${createdCustomers.length} customers inserted`);
    
    // Create transactions for each customer
    const transactions = [];
    
    for (const customer of createdCustomers) {
      // Invoice transaction
      transactions.push({
        customerId: customer._id,
        customerName: customer.name,
        type: 'invoice',
        amount: Math.floor(Math.random() * 2000) + 1000,
        date: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000),
        status: Math.random() > 0.3 ? 'completed' : 'pending',
        description: 'Monthly services',
        reference: `INV-${Math.floor(Math.random() * 10000)}`,
      });
      
      // Payment transaction
      transactions.push({
        customerId: customer._id,
        customerName: customer.name,
        type: 'payment',
        amount: Math.floor(Math.random() * 1000) + 500,
        date: new Date(Date.now() - Math.floor(Math.random() * 15) * 86400000),
        status: 'completed',
        description: 'Payment received',
        reference: `PAY-${Math.floor(Math.random() * 10000)}`,
        paymentMethod: ['cash', 'credit', 'bank transfer'][Math.floor(Math.random() * 3)]
      });
    }
    
    const createdTransactions = await Transaction.insertMany(transactions);
    console.log(`${createdTransactions.length} transactions inserted`);
    
    // Create notification rules
    const notificationRules = [
      {
        name: 'Invoice Due Reminder',
        triggerType: 'payment_due',
        conditions: { daysBeforeDue: 3 },
        active: true,
        followUpSequence: {
          name: 'Payment Due Sequence',
          steps: [
            {
              type: 'email',
              delay: 0,
              template: 'Your invoice is due in 3 days. Please make payment to avoid late fees.'
            },
            {
              type: 'sms',
              delay: 2,
              template: 'Reminder: Your invoice is due tomorrow. Please make payment.'
            }
          ]
        }
      },
      {
        name: 'Payment Overdue Alert',
        triggerType: 'payment_overdue',
        conditions: { daysOverdue: 7 },
        active: true,
        followUpSequence: {
          name: 'Overdue Payment Sequence',
          steps: [
            {
              type: 'email',
              delay: 0,
              template: 'Your payment is now 7 days overdue. Please make payment as soon as possible.'
            },
            {
              type: 'call',
              delay: 3,
              template: 'Call to discuss overdue payment and payment options.'
            }
          ]
        }
      }
    ];
    
    const createdRules = await NotificationRule.insertMany(notificationRules);
    console.log(`${createdRules.length} notification rules inserted`);
    
    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

// Run the seed function
seedDatabase();