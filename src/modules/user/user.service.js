import User from './user.model.js';
import Manager from '../manager/manager.model.js';
import Employee from '../employee/employee.model.js';
import managerService from '../manager/manager.service.js';
import employeeService from '../employee/employee.service.js';
import customerService from '../customer/customer.service.js';
import { ROLES, ROLE_CREATION_PERMISSIONS } from '../../constants/roles.js';

// Ensure all models are registered in mongoose
import '../superAdmin/superAdmin.model.js';
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

      default: {
        const err = new Error(`Unsupported role '${role}'`);
        err.statusCode = 400;
        throw err;
      }
    }
  }

  /**
   * Update user details and profile by delegating to specific service or direct update
   */
  async updateUser(userId, { userData = {}, profileData = {}, updaterRole, updaterId, updaterUser = null }) {
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
        return await employeeService.updateEmployee(
          userId,
          { userData, profileData },
          updaterUser || { role: updaterRole, _id: updaterId }
        );

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

      default: {
        const err = new Error(`Unsupported role '${targetUser.role}'`);
        err.statusCode = 400;
        throw err;
      }
    }
  }

  /**
   * Delete user and their profile
   */
  async deleteUser(userId, { deleterRole, deleterId, deleterUser = null }) {
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
        return await employeeService.deleteEmployee(
          userId,
          deleterUser || { role: deleterRole, _id: deleterId }
        );

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
  async toggleStatus(userId, { isActive, updaterRole, updaterId, updaterUser = null }) {
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

    // If Manager toggling an employee's status, verify the employee belongs to their team
    if (
      (updaterRole === ROLES.MANAGER || updaterUser?.role === ROLES.MANAGER) &&
      targetUser.role === ROLES.EMPLOYEE
    ) {
      const managerDoc = await Manager.findOne({ user: updaterId });
      const employeeDoc = await Employee.findOne({ user: userId });
      if (
        !managerDoc ||
        !employeeDoc ||
        !employeeDoc.manager ||
        String(employeeDoc.manager) !== String(managerDoc._id)
      ) {
        const err = new Error(
          'Access denied. You can only toggle status of employees belonging to your managed team.'
        );
        err.statusCode = 403;
        throw err;
      }
    }

    targetUser.isActive = isActive !== undefined ? isActive : !targetUser.isActive;
    await targetUser.save();

    return await User.findById(userId).populate('profile');
  }

  /**
   * Get all users with search, role filter, pagination
   * Scopes managers to only see their own employees and customers
   */
  async getAllUsers(
    { role, search, managerId, page = 1, limit = 10 },
    requestingUser = null
  ) {
    const query = {};

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Role scoping for Managers
    if (requestingUser && requestingUser.role === ROLES.MANAGER) {
      const managerDoc = await Manager.findOne({ user: requestingUser._id });
      const managedEmployees = await Employee.find({ manager: managerDoc?._id });
      const managedUserIds = managedEmployees.map((e) => e.user);

      if (role && role.toUpperCase() === ROLES.EMPLOYEE) {
        query._id = { $in: managedUserIds };
        query.role = ROLES.EMPLOYEE;
      } else if (role) {
        query.role = role.toUpperCase();
      } else {
        query.$or = [
          { _id: { $in: managedUserIds } },
          { role: ROLES.CUSTOMER }
        ];
      }
    } else {
      if (role) {
        query.role = role.toUpperCase();
      }

      // If Super Admin filters by manager
      if (managerId) {
        const targetManagerDoc = await employeeService.resolveManager(managerId);
        if (targetManagerDoc) {
          const employees = await Employee.find({ manager: targetManagerDoc._id });
          query._id = { $in: employees.map((e) => e.user) };
        }
      }
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
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
