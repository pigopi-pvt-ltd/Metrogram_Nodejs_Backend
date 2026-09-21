import jwt from 'jsonwebtoken';
import User from '../user/user.model.js';

class AuthService {
  generateToken(id) {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
  }

  async login({ email, password }) {
    if (!email || !password) {
      const err = new Error('Please provide both email and password');
      err.statusCode = 400;
      throw err;
    }

    const user = await User.findOne({ email: email.toLowerCase() })
      .select('+password')
      .populate('profile');

    if (!user) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    if (!user.isActive) {
      const err = new Error('Your account has been deactivated. Please contact an administrator.');
      err.statusCode = 403;
      throw err;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      const err = new Error('Invalid email or password');
      err.statusCode = 401;
      throw err;
    }

    const token = this.generateToken(user._id);
    user.password = undefined;

    return { token, user };
  }

  async getMe(userId) {
    return await User.findById(userId)
      .populate('profile')
      .populate('createdBy', 'firstName lastName email role');
  }
}

export default new AuthService();
