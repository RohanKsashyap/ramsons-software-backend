const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB connection string from environment variables 
const MONGO_URI = process.env.MONGO_URI 
// Connect to MongoDB using connection string from environment variables
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 4000,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB at ${MONGO_URI}: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
