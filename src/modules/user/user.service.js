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
        return await customerService.createCustomer({
          userData,
          profileData,
          creatorId,
          creatorRole
        });

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
        return await customerService.updateCustomer(
          userId,
          { userData, profileData },
          updaterUser || { role: updaterRole, _id: updaterId }
        );

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
        return await customerService.deleteCustomer(
          userId,
          deleterUser || { role: deleterRole, _id: deleterId }
        );

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

    // If Manager or Employee toggling a customer's status, verify customer ownership
    if (targetUser.role === ROLES.CUSTOMER) {
      await customerService.verifyCustomerAccess(
        userId,
        updaterUser || { role: updaterRole, _id: updaterId },
        'toggle status of'
      );
    }

    targetUser.isActive = isActive !== undefined ? isActive : !targetUser.isActive;
    await targetUser.save();

    return await User.findById(userId).populate('profile');
  }

  /**
   * Get all users with search, role filter, pagination
   * Scopes managers to only see their own employees and customers
   * Scopes employees to only see themselves and their registered/assigned customers
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

    // Role scoping for Employees
    if (requestingUser && requestingUser.role === ROLES.EMPLOYEE) {
      const myCustomers = await Customer.find({ assignedEmployee: requestingUser._id }).select('user');
      const myCustomerUserIds = myCustomers.map((c) => c.user);
      const createdUsers = await User.find({ role: ROLES.CUSTOMER, createdBy: requestingUser._id }).select('_id');
      const allMyCustomerUserIds = [...new Set([...myCustomerUserIds.map(String), ...createdUsers.map((u) => String(u._id))])];

      if (role && role.toUpperCase() === ROLES.CUSTOMER) {
        query._id = { $in: allMyCustomerUserIds };
        query.role = ROLES.CUSTOMER;
      } else if (role && role.toUpperCase() === ROLES.EMPLOYEE) {
        query._id = requestingUser._id;
        query.role = ROLES.EMPLOYEE;
      } else if (role) {
        query._id = null;
      } else {
        query._id = { $in: [...allMyCustomerUserIds, requestingUser._id] };
      }
    }
    // Role scoping for Managers
    else if (requestingUser && requestingUser.role === ROLES.MANAGER) {
      const managerDoc = await Manager.findOne({ user: requestingUser._id });
      const managedEmployees = await Employee.find({ manager: managerDoc?._id });
      const managedUserIds = managedEmployees.map((e) => e.user);
      const allowedStaffIds = [...managedUserIds, requestingUser._id];

      // Find customer IDs registered by or assigned to employees under this manager (plus manager's direct customers)
      const teamCustomers = await Customer.find({ assignedEmployee: { $in: managedUserIds } }).select('user');
      const teamCustomerUserIdsFromAssigned = teamCustomers.map((c) => c.user);
      const createdUsers = await User.find({ role: ROLES.CUSTOMER, createdBy: { $in: allowedStaffIds } }).select('_id');
      const allTeamCustomerUserIds = [...new Set([...teamCustomerUserIdsFromAssigned.map(String), ...createdUsers.map((u) => String(u._id))])];

      if (role && role.toUpperCase() === ROLES.EMPLOYEE) {
        query._id = { $in: managedUserIds };
        query.role = ROLES.EMPLOYEE;
      } else if (role && role.toUpperCase() === ROLES.CUSTOMER) {
        query._id = { $in: allTeamCustomerUserIds };
        query.role = ROLES.CUSTOMER;
      } else if (role) {
        if (role.toUpperCase() === ROLES.MANAGER) {
          query._id = requestingUser._id;
          query.role = ROLES.MANAGER;
        } else {
          query._id = null;
        }
      } else {
        query._id = { $in: [...managedUserIds, ...allTeamCustomerUserIds, requestingUser._id] };
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
   * Enforces role isolation verification for customers
   */
  async getUserById(id, requestingUser = null) {
    const user = await User.findById(id)
      .populate('profile')
      .populate('createdBy', 'firstName lastName email role');

    if (!user) return null;

    if (user.role === ROLES.CUSTOMER && requestingUser) {
      await customerService.verifyCustomerAccess(id, requestingUser, 'view');
    }

    return user;
  }
}

export default new UserService();
