const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB connection string - using local MongoDB or fallback to memory storage
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rasmsons_accounting';

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGO_URI, {
      // These options are no longer needed in newer mongoose versions but kept for compatibility
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;