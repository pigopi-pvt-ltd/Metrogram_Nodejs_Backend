import User from './user.model.js';
import managerService from '../manager/manager.service.js';
import employeeService from '../employee/employee.service.js';
import customerService from '../customer/customer.service.js';
import { ROLES, ROLE_CREATION_PERMISSIONS } from '../../constants/roles.js';

// Ensure all models are registered in mongoose
import '../superAdmin/superAdmin.model.js';
import '../manager/manager.model.js';
import '../employee/employee.model.js';
import '../customer/customer.model.js';
import '../card/cardPlan.model.js';
import '../service/service.model.js';

class UserService {
  /**
   * Create user with role validation and profile creation
   */
  async createUserByRole({ role, userData, profileData = {}, creatorId, creatorRole }) {
    const upperRole = role.toUpperCase();
    const allowedRoles = ROLE_CREATION_PERMISSIONS[creatorRole] || [];

    if (!allowedRoles.includes(upperRole)) {
      const err = new Error(
        `Role '${creatorRole}' is not permitted to create a user with role '${upperRole}'. Allowed roles: [${allowedRoles.join(', ')}]`
      );
      err.statusCode = 403;
      throw err;
    }

    switch (upperRole) {
      case ROLES.MANAGER:
        return await managerService.createManager({ userData, profileData, creatorId });

      case ROLES.EMPLOYEE:
        return await employeeService.createEmployee({ userData, profileData, creatorId, creatorRole });

      case ROLES.CUSTOMER:
        return await customerService.createCustomer({ userData, profileData, creatorId });

      default:
        const err = new Error(`Unsupported role '${role}'`);
        err.statusCode = 400;
        throw err;
    }
  }

  /**
   * Update user details and profile by delegating to specific service or direct update
   */
  async updateUser(userId, { userData = {}, profileData = {}, updaterRole, updaterId }) {
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    // Permission check if updater is not updating themselves
    const isSelf = String(targetUser._id) === String(updaterId);
    if (!isSelf) {
      const allowedRoles = ROLE_CREATION_PERMISSIONS[updaterRole] || [];
      if (!allowedRoles.includes(targetUser.role)) {
        const err = new Error(
          `Role '${updaterRole}' is not permitted to modify users with role '${targetUser.role}'`
        );
        err.statusCode = 403;
        throw err;
      }
    }

    switch (targetUser.role) {
      case ROLES.MANAGER:
        return await managerService.updateManager(userId, { userData, profileData });

      case ROLES.EMPLOYEE:
        return await employeeService.updateEmployee(userId, { userData, profileData });

      case ROLES.CUSTOMER:
        return await customerService.updateCustomer(userId, { userData, profileData });

      case ROLES.SUPER_ADMIN: {
        if (!isSelf && updaterRole !== ROLES.SUPER_ADMIN) {
          const err = new Error('Unauthorized to modify Super Admin');
          err.statusCode = 403;
          throw err;
        }
        if (userData.firstName) targetUser.firstName = userData.firstName;
        if (userData.lastName) targetUser.lastName = userData.lastName;
        if (userData.phoneNumber !== undefined) targetUser.phoneNumber = userData.phoneNumber;
        if (userData.password) targetUser.password = userData.password;
        await targetUser.save();
        return await User.findById(userId).populate('profile');
      }

      default:
        const err = new Error(`Unsupported role '${targetUser.role}'`);
        err.statusCode = 400;
        throw err;
    }
  }

  /**
   * Delete user and their profile
   */
  async deleteUser(userId, { deleterRole, deleterId }) {
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    if (String(targetUser._id) === String(deleterId)) {
      const err = new Error('You cannot delete your own account');
      err.statusCode = 400;
      throw err;
    }

    const allowedRoles = ROLE_CREATION_PERMISSIONS[deleterRole] || [];
    if (!allowedRoles.includes(targetUser.role)) {
      const err = new Error(
        `Role '${deleterRole}' is not permitted to delete users with role '${targetUser.role}'`
      );
      err.statusCode = 403;
      throw err;
    }

    switch (targetUser.role) {
      case ROLES.MANAGER:
        return await managerService.deleteManager(userId);

      case ROLES.EMPLOYEE:
        return await employeeService.deleteEmployee(userId);

      case ROLES.CUSTOMER:
        return await customerService.deleteCustomer(userId);

      default:
        await User.findByIdAndDelete(userId);
        return { success: true, message: 'User deleted successfully' };
    }
  }

  /**
   * Toggle user active status
   */
  async toggleStatus(userId, { isActive, updaterRole, updaterId }) {
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    if (String(targetUser._id) === String(updaterId)) {
      const err = new Error('You cannot deactivate your own account');
      err.statusCode = 400;
      throw err;
    }

    const allowedRoles = ROLE_CREATION_PERMISSIONS[updaterRole] || [];
    if (!allowedRoles.includes(targetUser.role)) {
      const err = new Error(
        `Role '${updaterRole}' is not permitted to change status for users with role '${targetUser.role}'`
      );
      err.statusCode = 403;
      throw err;
    }

    targetUser.isActive = isActive !== undefined ? isActive : !targetUser.isActive;
    await targetUser.save();

    return await User.findById(userId).populate('profile');
  }

  /**
   * Get all users with search, role filter, pagination
   */
  async getAllUsers({ role, search, page = 1, limit = 10 }) {
    const query = {};

    if (role) {
      query.role = role.toUpperCase();
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      User.find(query)
        .populate('profile')
        .populate('createdBy', 'firstName lastName email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      User.countDocuments(query)
    ]);

    return {
      users,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum
    };
  }

  /**
   * Get single user by ID
   */
  async getUserById(id) {
    return await User.findById(id)
      .populate('profile')
      .populate('createdBy', 'firstName lastName email role');
  }
}

export default new UserService();
