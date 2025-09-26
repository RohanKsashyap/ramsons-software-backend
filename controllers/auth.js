const asyncHandler = require('express-async-handler');
const {
  registerUser,
  loginUser,
  requestPasswordReset,
  resetPassword,
} = require('../services/authService');

const register = asyncHandler(async (req, res) => {
  const { email, password, name } = req.body;
  const { user, token } = await registerUser({ email, password, name });

  res.status(201).json({ success: true, data: user, token });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { user, token } = await loginUser({ email, password });

  res.json({ success: true, data: user, token });
});

const requestReset = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const { resetToken, expiresAt } = await requestPasswordReset({ email });

  res.json({
    success: true,
    message: 'Reset token generated successfully.',
    resetToken,
    expiresAt,
  });
});

const resetPasswordHandler = asyncHandler(async (req, res) => {
  const { email, token, newPassword } = req.body;
  const { user, token: authToken } = await resetPassword({ email, token, newPassword });

  res.json({
    success: true,
    message: 'Password reset successful.',
    data: user,
    token: authToken,
  });
});

module.exports = {
  register,
  login,
  requestReset,
  resetPassword: resetPasswordHandler,
};