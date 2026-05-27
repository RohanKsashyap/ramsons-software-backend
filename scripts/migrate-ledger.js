const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const Customer = require('../models/Customer');
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const PaymentAllocation = require('../models/PaymentAllocation');
const { resetAndReallocate } = require('../services/ledgerService');

// Helper to format reference/number (shorten if it looks like a MongoDB ID)
const formatRef = (ref, prefix, fallbackId) => {
  if (!ref || ref === '' || /^[0-9a-fA-F]{24}$/.test(ref)) {
    return `${prefix}-${fallbackId.toString().slice(-6).toUpperCase()}`;
  }
  return ref;
};

const migrate = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ramsons');
    console.log('Connected to MongoDB for migration...');

    // 1. Clear existing new ledger data
    console.log('Clearing existing Invoice, Payment, and Allocation records...');
    await Invoice.deleteMany({});
    await Payment.deleteMany({});
    await PaymentAllocation.deleteMany({});

    // 2. Get all customers
    const customers = await Customer.find({});
    console.log(`Found ${customers.length} customers to migrate.`);

    for (const customer of customers) {
      console.log(`Migrating data for customer: ${customer.name} (${customer._id})`);

      // 3. Get all transactions for this customer
      const transactions = await Transaction.find({ customerId: customer._id })
        .populate({
          path: 'items.productId',
          model: 'Product',
          select: 'name'
        })
        .populate({
          path: 'items.product',
          model: 'Product',
          select: 'name'
        })
        .sort({ date: 1, createdAt: 1 });
      
      for (const tx of transactions) {
        if (tx.type === 'invoice') {
          const invNumber = formatRef(tx.invoiceNumber || tx.reference, 'INV', tx._id);
          
          await Invoice.create({
            customerId: customer._id,
            invoiceNumber: invNumber,
            totalAmount: tx.amount,
            items: (tx.items || []).map(item => {
              // Try to find product name from populated fields or fallback
              const pName = item.productId?.name || item.product?.name || 'Product';
              const pId = item.productId?._id || item.product?._id || item.productId || item.product;
              
              return {
                productId: pId,
                productName: pName,
                quantity: item.quantity,
                pricePerUnit: item.pricePerUnit,
                total: item.total
              };
            }),
            date: tx.date,
            createdAt: tx.createdAt
          });

          // Also update the Transaction document to have pendingAmount for dashboard alerts
          await Transaction.findByIdAndUpdate(tx._id, {
            pendingAmount: tx.amount,
            paidAmount: 0 // Will be updated by resetAndReallocate
          });
          
          console.log(`  - Created Invoice: ${invNumber}`);
        } else if (tx.type === 'payment' || tx.type === 'advance') {
          const payNumber = formatRef(tx.paymentNumber || tx.reference, 'PAY', tx._id);
          
          await Payment.create({
            customerId: customer._id,
            paymentNumber: payNumber,
            amount: tx.amount,
            paymentMethod: tx.paymentMethod || (tx.type === 'advance' ? 'advance' : 'cash'),
            notes: tx.description || tx.notes,
            date: tx.date,
            createdAt: tx.createdAt
          });
          console.log(`  - Created Payment: ${payNumber}`);
        }
      }

      // 4. Run FIFO allocation for this customer
      console.log(`  - Running allocation for ${customer.name}...`);
      await resetAndReallocate(customer._id);
    }

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

migrate();
