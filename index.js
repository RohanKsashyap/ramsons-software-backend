const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const cron = require('node-cron');
const connectDB = require('./config/db');
const { checkDueDateNotifications } = require('./controllers/notificationRules');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

// Route files
const customers = require('./routes/customers');
const transactions = require('./routes/transactions');
const notificationRules = require('./routes/notificationRules');
const dashboard = require('./routes/dashboard');
const reports = require('./routes/reports');

const app = express();

// Body parser
app.use(express.json());

// Dev logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Security headers
app.use(helmet());

// Enable CORS
app.use(cors());

// Mount routers
app.use('/api/v1/customers', customers);
app.use('/api/v1/transactions', transactions);
app.use('/api/v1/notification-rules', notificationRules);
app.use('/api/v1/dashboard', dashboard);
app.use('/api/v1/reports', reports);

// Schedule due date notification check to run daily at midnight
cron.schedule('0 0 * * *', async () => {
  console.log('Running scheduled due date notification check');
  try {
    await checkDueDateNotifications();
    console.log('Due date notification check completed successfully');
  } catch (error) {
    console.error('Error in due date notification check:', error);
  }
});

// Basic route for testing
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Rasmsons Accounting API' });
});

// Error handler middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: err.message || 'Server Error'
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api/v1`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
