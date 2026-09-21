import Employee from './employee.model.js';
import Manager from '../manager/manager.model.js';
import User from '../user/user.model.js';
import { ROLES, PROFILE_MODELS } from '../../constants/roles.js';

class EmployeeService {
  /**
   * Create an Employee user and profile
   */
  async createEmployee({ userData, profileData, creatorId, creatorRole }) {
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
      role: ROLES.EMPLOYEE,
      profileModel: PROFILE_MODELS[ROLES.EMPLOYEE],
      createdBy: creatorId
    });

    await user.save();

    // Determine manager reference
    let managerRef = profileData.manager;
    if (!managerRef && creatorRole === ROLES.MANAGER) {
      const managerProfile = await Manager.findOne({ user: creatorId });
      if (managerProfile) {
        managerRef = managerProfile._id;
      }
    }

    const employeeProfile = new Employee({
      user: user._id,
      employeeCode: profileData.employeeCode || `EMP-${Date.now()}`,
      designation: profileData.designation || 'Staff Associate',
      department: profileData.department || 'Operations',
      manager: managerRef || null
    });

    await employeeProfile.save();

    // If assigned to a manager, update manager's managedEmployees list
    if (managerRef) {
      await Manager.findByIdAndUpdate(managerRef, {
        $addToSet: { managedEmployees: employeeProfile._id }
      });
    }

    user.profile = employeeProfile._id;
    await user.save();

    return await User.findById(user._id)
      .populate({
        path: 'profile',
        populate: { path: 'manager', select: 'department branch' }
      })
      .populate('createdBy', 'firstName lastName email role');
  }

  /**
   * Update Employee user and profile
   */
  async updateEmployee(userId, { userData = {}, profileData = {} }) {
    const user = await User.findById(userId);
    if (!user || user.role !== ROLES.EMPLOYEE) {
      const err = new Error('Employee not found');
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
      const currentProfile = await Employee.findOne({ user: userId });
      if (currentProfile && profileData.manager && String(currentProfile.manager) !== String(profileData.manager)) {
        // Remove from old manager
        if (currentProfile.manager) {
          await Manager.findByIdAndUpdate(currentProfile.manager, {
            $pull: { managedEmployees: currentProfile._id }
          });
        }
        // Add to new manager
        await Manager.findByIdAndUpdate(profileData.manager, {
          $addToSet: { managedEmployees: currentProfile._id }
        });
      }

      await Employee.findOneAndUpdate(
        { user: userId },
        { $set: profileData },
        { new: true, runValidators: true }
      );
    }

    return await User.findById(userId)
      .populate({
        path: 'profile',
        populate: { path: 'manager', select: 'department branch' }
      })
      .populate('createdBy', 'firstName lastName email role');
  }

  /**
   * Delete Employee user and profile
   */
  async deleteEmployee(userId) {
    const user = await User.findById(userId);
    if (!user || user.role !== ROLES.EMPLOYEE) {
      const err = new Error('Employee not found');
      err.statusCode = 404;
      throw err;
    }

    const employeeProfile = await Employee.findOne({ user: userId });
    if (employeeProfile) {
      if (employeeProfile.manager) {
        await Manager.findByIdAndUpdate(employeeProfile.manager, {
          $pull: { managedEmployees: employeeProfile._id }
        });
      }
      await Employee.findByIdAndDelete(employeeProfile._id);
    }

    await User.findByIdAndDelete(userId);
    return { success: true, message: 'Employee and associated profile deleted successfully' };
  }

  /**
   * Get Employee Profile by User ID
   */
  async getProfileByUserId(userId) {
    return await Employee.findOne({ user: userId })
      .populate('user')
      .populate('manager');
  }

  /**
   * List all employee profiles
   */
  async getAllEmployees(queryFilter = {}) {
    return await Employee.find(queryFilter).populate('user').populate('manager');
  }
}

export default new EmployeeService();
