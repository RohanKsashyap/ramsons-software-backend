const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI 
const connectDB = async () => {
  try {
    const connection = await mongoose.connect(MONGO_URI, {
      // Explicit options for clarity and local stability
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`MongoDB Connected: ${connection.connection.host}`);
    return connection;
  } catch (error) {
    console.error(`Error connecting to MongoDB at ${MONGO_URI}: ${error.message}`);
    console.error('Ensure MongoDB is installed locally and the service is running.');
    process.exit(1);
  }
};

module.exports = connectDB;