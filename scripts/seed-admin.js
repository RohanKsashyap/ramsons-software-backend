const mongoose = require('mongoose');
const User = require('../models/User');
const connectDB = require('../config/db');

(async () => {
  try {
    await connectDB();

    const adminEmail = 'roy282227@gmail.com';

    let admin = await User.findOne({ email: adminEmail });

    if (!admin) {
      admin = await User.create({
        name: 'New Ramsons',
        email: adminEmail,
        password: 'admin123',
        isAdmin: true,
      });
      console.log('Admin user created:', admin.email);
    } else {
      admin.name = 'New Ramsons';
      admin.password = 'admin123';
      admin.isAdmin = true;
      await admin.save();
      console.log('Existing admin updated:', admin.email);
    }
  } catch (err) {
    console.error('Failed to seed admin user:', err.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
})();