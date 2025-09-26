const User = require('../models/User');

async function registerUser({ email, password, name }) {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const error = new Error('Email already in use.');
    error.statusCode = 409;
    throw error;
  }

  const user = await User.create({ email, password, name });
  const token = user.generateJWT();
  return { user, token };
}

async function loginUser({ email, password }) {
  const user = await User.findOne({ email });
  if (!user) {
    const error = new Error('Invalid credentials.');
    error.statusCode = 401;
    throw error;
  }

  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    const error = new Error('Invalid credentials.');
    error.statusCode = 401;
    throw error;
  }

  const token = user.generateJWT();
  return { user, token };
}

async function requestPasswordReset({ email }) {
  const user = await User.findOne({ email });
  if (!user) {
    const error = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }

  const resetToken = user.generateResetToken();
  await user.save();

  return { resetToken, expiresAt: user.resetPasswordExpiresAt, user };
}

async function resetPassword({ email, token, newPassword }) {
  const user = await User.findOne({ email });
  if (!user || !user.validateResetToken(token)) {
    const error = new Error('Invalid or expired reset token.');
    error.statusCode = 400;
    throw error;
  }

  user.password = newPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpiresAt = undefined;
  await user.save();

  const authToken = user.generateJWT();
  return { user, token: authToken };
}

module.exports = {
  registerUser,
  loginUser,
  requestPasswordReset,
  resetPassword,
};