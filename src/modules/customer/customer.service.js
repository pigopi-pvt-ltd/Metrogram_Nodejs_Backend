import Customer from './customer.model.js';
import User from '../user/user.model.js';
import { ROLES, PROFILE_MODELS } from '../../constants/roles.js';
import { deleteFromCloudinary } from '../../config/cloudinary.js';

class CustomerService {
  /**
   * Create a Customer user and profile
   */
  async createCustomer({ userData, profileData = {}, creatorId }) {
    const existing = await User.findOne({ email: userData.email.toLowerCase() });
    if (existing) {
      const err = new Error('A user with this email address already exists');
      err.statusCode = 400;
      throw err;
    }

    const user = new User({
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email.toLowerCase(),
      password: userData.password,
      phoneNumber: userData.phoneNumber,
      role: ROLES.CUSTOMER,
      profileModel: PROFILE_MODELS[ROLES.CUSTOMER],
      createdBy: creatorId
    });

    await user.save();

    const customerProfile = new Customer({
      user: user._id,
      customerCode: profileData.customerCode || `CUST-${Date.now()}`,
      membershipType: profileData.membershipType || 'REGULAR',
      aadharNumber: profileData.aadharNumber || null,
      aadharImage: profileData.aadharImage || null,
      aadharImagePublicId: profileData.aadharImagePublicId || null,
      panNumber: profileData.panNumber ? profileData.panNumber.toUpperCase() : null,
      panImage: profileData.panImage || null,
      panImagePublicId: profileData.panImagePublicId || null,
      address: profileData.address || {},
      loyaltyPoints: profileData.loyaltyPoints || 0
    });

    await customerProfile.save();

    user.profile = customerProfile._id;
    await user.save();

    return await User.findById(user._id)
      .populate('profile')
      .populate('createdBy', 'firstName lastName email role');
  }

  /**
   * Update Customer user and profile
   */
  async updateCustomer(userId, { userData = {}, profileData = {} }) {
    let user = await User.findById(userId);

    // If not found by User ID, check if userId is the Customer profile's _id
    if (!user) {
      const customerDoc = await Customer.findById(userId);
      if (customerDoc && customerDoc.user) {
        user = await User.findById(customerDoc.user);
      }
    }

    if (!user || user.role !== ROLES.CUSTOMER) {
      const err = new Error('Customer not found');
      err.statusCode = 404;
      throw err;
    }

    const targetUserId = user._id;

    if (userData.firstName) user.firstName = userData.firstName;
    if (userData.lastName) user.lastName = userData.lastName;
    if (userData.phoneNumber !== undefined) user.phoneNumber = userData.phoneNumber;
    if (userData.isActive !== undefined) user.isActive = userData.isActive;
    if (userData.password) {
      user.password = userData.password;
    }

    if (userData.email && userData.email.toLowerCase() !== user.email) {
      const existing = await User.findOne({ email: userData.email.toLowerCase() });
      if (existing) {
        const err = new Error('Email is already in use by another user');
        err.statusCode = 400;
        throw err;
      }
      user.email = userData.email.toLowerCase();
    }

    await user.save();

    if (Object.keys(profileData).length > 0) {
      await Customer.findOneAndUpdate(
        { user: targetUserId },
        { $set: profileData },
        { new: true, runValidators: true }
      );
    }

    return await User.findById(targetUserId)
      .populate('profile')
      .populate('createdBy', 'firstName lastName email role');
  }

  /**
   * Delete Customer user and profile
   */
  async deleteCustomer(userId) {
    const user = await User.findById(userId);
    if (!user || user.role !== ROLES.CUSTOMER) {
      const err = new Error('Customer not found');
      err.statusCode = 404;
      throw err;
    }

    const customerProfile = await Customer.findOne({ user: userId });
    if (customerProfile) {
      if (customerProfile.aadharImagePublicId) {
        deleteFromCloudinary(customerProfile.aadharImagePublicId).catch(err => {
          console.error('[Cloudinary] Failed to delete Aadhar document:', err.message);
        });
      }
      if (customerProfile.panImagePublicId) {
        deleteFromCloudinary(customerProfile.panImagePublicId).catch(err => {
          console.error('[Cloudinary] Failed to delete PAN document:', err.message);
        });
      }
      await Customer.findByIdAndDelete(customerProfile._id);
    }

    await User.findByIdAndDelete(userId);

    return { success: true, message: 'Customer and associated profile deleted successfully' };
  }

  /**
   * Get Customer Profile by User ID
   */
  async getProfileByUserId(userId) {
    return await Customer.findOne({ user: userId }).populate('user');
  }

  /**
   * List all customer profiles
   */
  async getAllCustomers(queryFilter = {}) {
    return await Customer.find(queryFilter).populate('user');
  }
}

export default new CustomerService();
