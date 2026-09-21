import Manager from './manager.model.js';
import User from '../user/user.model.js';
import Employee from '../employee/employee.model.js';
import { ROLES, PROFILE_MODELS } from '../../constants/roles.js';

class ManagerService {
  /**
   * Create a Manager user and profile
   */
  async createManager({ userData, profileData, creatorId }) {
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
      role: ROLES.MANAGER,
      profileModel: PROFILE_MODELS[ROLES.MANAGER],
      createdBy: creatorId
    });

    await user.save();

    const managerProfile = new Manager({
      user: user._id,
      department: profileData.department || 'General Management',
      branch: profileData.branch || 'Headquarters',
      maxTeamSize: profileData.maxTeamSize || 20
    });

    await managerProfile.save();

    user.profile = managerProfile._id;
    await user.save();

    return await User.findById(user._id)
      .populate('profile')
      .populate('createdBy', 'firstName lastName email role');
  }

  /**
   * Update Manager user and profile
   */
  async updateManager(userId, { userData = {}, profileData = {} }) {
    const user = await User.findById(userId);
    if (!user || user.role !== ROLES.MANAGER) {
      const err = new Error('Manager not found');
      err.statusCode = 404;
      throw err;
    }

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
      await Manager.findOneAndUpdate(
        { user: userId },
        { $set: profileData },
        { new: true, runValidators: true }
      );
    }

    return await User.findById(userId)
      .populate('profile')
      .populate('createdBy', 'firstName lastName email role');
  }

  /**
   * Delete Manager user and profile
   */
  async deleteManager(userId) {
    const user = await User.findById(userId);
    if (!user || user.role !== ROLES.MANAGER) {
      const err = new Error('Manager not found');
      err.statusCode = 404;
      throw err;
    }

    // Unassign manager from employees
    const managerProfile = await Manager.findOne({ user: userId });
    if (managerProfile) {
      await Employee.updateMany({ manager: managerProfile._id }, { $set: { manager: null } });
      await Manager.findByIdAndDelete(managerProfile._id);
    }

    await User.findByIdAndDelete(userId);
    return { success: true, message: 'Manager and associated profile deleted successfully' };
  }

  /**
   * Get Manager Profile by User ID
   */
  async getProfileByUserId(userId) {
    return await Manager.findOne({ user: userId })
      .populate('user')
      .populate('managedEmployees');
  }

  /**
   * List all manager profiles
   */
  async getAllManagers() {
    return await Manager.find().populate('user').populate('managedEmployees');
  }
}

export default new ManagerService();
