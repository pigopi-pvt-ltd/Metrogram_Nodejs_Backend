import jwt from 'jsonwebtoken';
import User from '../user/user.model.js';
import Customer from '../customer/customer.model.js';
import CardPlan from '../card/cardPlan.model.js';
import { ROLES, PROFILE_MODELS } from '../../constants/roles.js';

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

    // Handle role-specific profile population
    if (user.role === ROLES.CUSTOMER) {
      if (!user.profile) {
        let customerProfile = await Customer.findOne({ user: user._id });
        if (!customerProfile) {
          customerProfile = new Customer({
            user: user._id,
            customerCode: `CUST-${Date.now().toString().slice(-6)}`
          });
          await customerProfile.save();
        }
        user.profile = customerProfile._id;
        user.profileModel = PROFILE_MODELS.CUSTOMER;
        await user.save();
        await user.populate('profile');
      }

      if (user.profile) {
        await user.populate({
          path: 'profile.activeCard.cardPlan',
          strictPopulate: false
        });
      }
    }

    const token = this.generateToken(user._id);
    user.password = undefined;

    return { token, user };
  }

  async getMe(userId) {
    let user = await User.findById(userId)
      .populate('profile')
      .populate('createdBy', 'firstName lastName email role');

    if (!user) return null;

    if (user.role === ROLES.CUSTOMER) {
      let customerProfile = await Customer.findOne({ user: userId });

      if (!customerProfile) {
        customerProfile = new Customer({
          user: userId,
          customerCode: `CUST-${Date.now().toString().slice(-6)}`
        });
        await customerProfile.save();
      }

      // Check card expiration if card exists
      if (customerProfile.activeCard && customerProfile.activeCard.expiresAt) {
        if (new Date() > new Date(customerProfile.activeCard.expiresAt)) {
          customerProfile.activeCard.status = 'EXPIRED';
          customerProfile.hasCard = false;
          await customerProfile.save();
        }
      }

      // Ensure user.profile reference and profileModel are properly linked
      if (!user.profile || String(user.profile._id) !== String(customerProfile._id) || user.profileModel !== PROFILE_MODELS.CUSTOMER) {
        await User.findByIdAndUpdate(userId, {
          profile: customerProfile._id,
          profileModel: PROFILE_MODELS.CUSTOMER
        });

        user = await User.findById(userId)
          .populate('profile')
          .populate('createdBy', 'firstName lastName email role');
      }

      if (user.profile) {
        await user.populate({
          path: 'profile.activeCard.cardPlan',
          strictPopulate: false
        });
      }
    }

    return user;
  }
}

export default new AuthService();
