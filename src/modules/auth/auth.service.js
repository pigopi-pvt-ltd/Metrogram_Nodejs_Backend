import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../user/user.model.js';
import Customer from '../customer/customer.model.js';
import CardPlan from '../card/cardPlan.model.js';
import { ROLES, PROFILE_MODELS } from '../../constants/roles.js';
import emailService from '../../services/email.service.js';

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

  /**
   * Customer Self-Registration (Public)
   */
  async registerCustomer({ userData, profileData = {} }) {
    if (!userData.email || !userData.password || !userData.firstName || !userData.lastName) {
      const err = new Error('Please provide first name, last name, email, and password');
      err.statusCode = 400;
      throw err;
    }

    if (userData.password.length < 6) {
      const err = new Error('Password must be at least 6 characters long');
      err.statusCode = 400;
      throw err;
    }

    const existing = await User.findOne({ email: userData.email.toLowerCase() });
    if (existing) {
      const err = new Error('An account with this email already exists');
      err.statusCode = 400;
      throw err;
    }

    // Create Base User with CUSTOMER role
    const user = new User({
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email.toLowerCase(),
      password: userData.password,
      phoneNumber: userData.phoneNumber,
      role: ROLES.CUSTOMER,
      profileModel: PROFILE_MODELS[ROLES.CUSTOMER],
      createdBy: null
    });

    await user.save();

    // Create Customer profile
    const customerProfile = new Customer({
      user: user._id,
      customerCode: profileData.customerCode || `CUST-${Date.now().toString().slice(-6)}`,
      membershipType: profileData.membershipType || 'REGULAR',
      aadharNumber: profileData.aadharNumber || null,
      aadharImage: profileData.aadharImage || null,
      aadharImagePublicId: profileData.aadharImagePublicId || null,
      panNumber: profileData.panNumber ? profileData.panNumber.toUpperCase() : null,
      panImage: profileData.panImage || null,
      panImagePublicId: profileData.panImagePublicId || null,
      address: profileData.address || {},
      loyaltyPoints: 0
    });

    await customerProfile.save();

    user.profile = customerProfile._id;
    await user.save();

    const populatedUser = await User.findById(user._id)
      .populate('profile');

    const token = this.generateToken(user._id);
    populatedUser.password = undefined;

    return { token, user: populatedUser };
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

  /**
   * Change password for logged-in user
   */
  async changePassword(userId, { currentPassword, newPassword, confirmPassword }) {
    if (!currentPassword || !newPassword) {
      const err = new Error('Please provide current password and new password');
      err.statusCode = 400;
      throw err;
    }

    if (newPassword.length < 6) {
      const err = new Error('New password must be at least 6 characters long');
      err.statusCode = 400;
      throw err;
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      const err = new Error('New password and confirmation do not match');
      err.statusCode = 400;
      throw err;
    }

    const user = await User.findById(userId).select('+password');
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      const err = new Error('Current password does not match');
      err.statusCode = 400;
      throw err;
    }

    user.password = newPassword;
    await user.save();

    // Send confirmation email asynchronously (ignore errors to avoid blocking response)
    emailService.sendPasswordChangedConfirmation({
      to: user.email,
      name: user.fullName || user.firstName
    }).catch(err => {
      console.error('[EmailService] Failed to send password changed confirmation email:', err.message);
    });

    return { message: 'Password changed successfully' };
  }

  /**
   * Forgot password: generates a 6-digit OTP and emails it to the user
   */
  async forgotPassword(email) {
    if (!email) {
      const err = new Error('Please provide your email address');
      err.statusCode = 400;
      throw err;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Return success message to prevent user enumeration attacks
      return {
        message: 'If an account with that email exists, a password reset code has been sent.'
      };
    }

    if (!user.isActive) {
      const err = new Error('Your account is deactivated. Please contact support.');
      err.statusCode = 403;
      throw err;
    }

    // Generate secure 6-digit OTP
    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash OTP using SHA256 before storing in DB
    const hashedOtp = crypto.createHash('sha256').update(rawOtp).digest('hex');

    // 10 minutes expiry
    user.resetPasswordOtp = hashedOtp;
    user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    try {
      await emailService.sendPasswordResetEmail({
        to: user.email,
        name: user.fullName || user.firstName,
        otp: rawOtp,
        expiresInMinutes: 10
      });

      return {
        message: 'Password reset code has been sent to your email.'
      };
    } catch (mailErr) {
      // Revert OTP if email sending fails
      user.resetPasswordOtp = undefined;
      user.resetPasswordExpires = undefined;
      await user.save({ validateBeforeSave: false });

      console.error('[AuthService] Error sending reset email:', mailErr);
      const err = new Error('Failed to send password reset email. Please try again later.');
      err.statusCode = 500;
      throw err;
    }
  }

  /**
   * Reset password using email, OTP, and new password
   */
  async resetPassword({ email, otp, newPassword, confirmPassword }) {
    if (!email || !otp || !newPassword) {
      const err = new Error('Please provide email, verification OTP, and new password');
      err.statusCode = 400;
      throw err;
    }

    if (newPassword.length < 6) {
      const err = new Error('New password must be at least 6 characters long');
      err.statusCode = 400;
      throw err;
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      const err = new Error('New password and confirmation do not match');
      err.statusCode = 400;
      throw err;
    }

    const hashedOtp = crypto.createHash('sha256').update(String(otp).trim()).digest('hex');

    const user = await User.findOne({
      email: email.toLowerCase(),
      resetPasswordOtp: hashedOtp,
      resetPasswordExpires: { $gt: new Date() }
    }).select('+resetPasswordOtp +resetPasswordExpires');

    if (!user) {
      const err = new Error('Invalid or expired verification code');
      err.statusCode = 400;
      throw err;
    }

    user.password = newPassword;
    user.resetPasswordOtp = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Send confirmation email
    emailService.sendPasswordChangedConfirmation({
      to: user.email,
      name: user.fullName || user.firstName
    }).catch(err => {
      console.error('[EmailService] Failed to send password changed confirmation email:', err.message);
    });

    return { message: 'Password has been reset successfully. You can now log in.' };
  }
}

export default new AuthService();
