const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const RESET_TOKEN_EXPIRATION_MINUTES = 15;

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    name: {
      type: String,
      trim: true,
    },
    resetPasswordToken: String,
    resetPasswordExpiresAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret) => {
        delete ret.password;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpiresAt;
        return ret;
      },
    },
  }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function matchPassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateJWT = function generateJWT() {
  const payload = { id: this._id, email: this.email };
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || '1d';

  return jwt.sign(payload, secret, { expiresIn });
};

userSchema.methods.generateResetToken = function generateResetToken() {
  const rawToken = Math.random().toString(36).slice(2, 8).toUpperCase();
  const salt = bcrypt.genSaltSync(10);
  this.resetPasswordToken = bcrypt.hashSync(rawToken, salt);
  this.resetPasswordExpiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRATION_MINUTES * 60 * 1000);
  return rawToken;
};

userSchema.methods.validateResetToken = function validateResetToken(candidateToken) {
  if (!this.resetPasswordToken || !this.resetPasswordExpiresAt) return false;
  if (this.resetPasswordExpiresAt < new Date()) return false;

  return bcrypt.compareSync(candidateToken, this.resetPasswordToken);
};

module.exports = mongoose.model('User', userSchema);