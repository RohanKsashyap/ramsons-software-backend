const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB connection string - using local MongoDB or fallback to memory storage
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/rasmsons_accounting';

// Connect to MongoDB with fallback to in-memory MongoDB for local testing
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGO_URI, {
      // These options are no longer needed in newer mongoose versions but kept for compatibility
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 4000,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error connecting to MongoDB at ${MONGO_URI}: ${error.message}`);
    console.warn('Falling back to in-memory MongoDB for local testing...');

    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongod = await MongoMemoryServer.create();
      const uri = mongod.getUri();

      const conn = await mongoose.connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });

      console.log(`In-memory MongoDB started at ${uri}`);

      // Gracefully stop in-memory server on process exit
      const cleanup = async () => {
        await mongoose.disconnect();
        await mongod.stop();
        process.exit(0);
      };
      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);

      return conn;
    } catch (memErr) {
      console.error('Failed to start in-memory MongoDB:', memErr);
      process.exit(1);
    }
  }
};

module.exports = connectDB;
