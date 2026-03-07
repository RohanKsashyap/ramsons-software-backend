const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI||'mongodb+srv://ottodev7806_db_user:13131313SABs@ramsons-software.xz7uwqz.mongodb.net/?retryWrites=true&w=majority&appName=ramsons-software';

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