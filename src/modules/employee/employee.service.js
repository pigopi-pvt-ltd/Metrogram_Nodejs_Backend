import Employee from './employee.model.js';
import Manager from '../manager/manager.model.js';
import User from '../user/user.model.js';
import { ROLES, PROFILE_MODELS } from '../../constants/roles.js';

class EmployeeService {
  /**
   * Helper to resolve a Manager document by either Manager Profile ID or Manager User ID
   */
  async resolveManager(managerInput) {
    if (!managerInput) return null;
    let managerDoc = await Manager.findById(managerInput).populate(
      'user',
      'firstName lastName email isActive role'
    );
    if (!managerDoc) {
      managerDoc = await Manager.findOne({ user: managerInput }).populate(
        'user',
        'firstName lastName email isActive role'
      );
    }
    return managerDoc;
  }

  /**
   * Create an Employee user and profile
   * - If registered by a Manager: automatically assigns employee under this manager, enforces manager's maxTeamSize.
   * - If registered by Super Admin: requires selecting a manager, validates manager status and enforces their maxTeamSize.
   */
  async createEmployee({ userData, profileData = {}, creatorId, creatorRole }) {
    const existing = await User.findOne({ email: userData.email.toLowerCase() });
    if (existing) {
      const err = new Error('A user with this email address already exists');
      err.statusCode = 400;
      throw err;
    }

    let managerRef = null;
    let managerDoc = null;

    if (creatorRole === ROLES.MANAGER) {
      // 1. Manager is registering the employee
      // Automatically assign the employee to the logged-in manager
      managerDoc = await Manager.findOne({ user: creatorId }).populate(
        'user',
        'firstName lastName email isActive role'
      );
      if (!managerDoc) {
        const err = new Error('Manager profile not found for the logged-in manager user');
        err.statusCode = 404;
        throw err;
      }

      // Enforce the manager's maximum recruitment limit
      const currentTeamSize = managerDoc.managedEmployees ? managerDoc.managedEmployees.length : 0;
      const maxAllowed = managerDoc.maxTeamSize || 20;

      if (currentTeamSize >= maxAllowed) {
        const err = new Error(
          `You have reached your maximum recruitment limit of ${maxAllowed} employees. Please contact Super Admin to increase your team capacity.`
        );
        err.statusCode = 400;
        throw err;
      }

      managerRef = managerDoc._id;
    } else if (creatorRole === ROLES.SUPER_ADMIN) {
      // 2. Super Admin is registering the employee
      // Super Admin MUST select which manager to put this employee under
      const targetManagerInput = profileData.manager || profileData.managerId;
      if (!targetManagerInput) {
        const err = new Error(
          'Super Admin must select a manager to put this employee under. Please provide the manager ID.'
        );
        err.statusCode = 400;
        throw err;
      }

      managerDoc = await this.resolveManager(targetManagerInput);
      if (!managerDoc) {
        const err = new Error(`Selected manager with ID '${targetManagerInput}' was not found`);
        err.statusCode = 404;
        throw err;
      }

      if (managerDoc.user && !managerDoc.user.isActive) {
        const err = new Error(
          `Selected manager '${managerDoc.user.firstName} ${managerDoc.user.lastName}' is inactive. Cannot assign employees to an inactive manager.`
        );
        err.statusCode = 400;
        throw err;
      }

      // Enforce selected manager's maximum recruitment limit
      const currentTeamSize = managerDoc.managedEmployees ? managerDoc.managedEmployees.length : 0;
      const maxAllowed = managerDoc.maxTeamSize || 20;

      if (currentTeamSize >= maxAllowed) {
        const managerName = managerDoc.user
          ? `${managerDoc.user.firstName} ${managerDoc.user.lastName}`
          : 'Selected manager';
        const err = new Error(
          `Manager '${managerName}' has reached their maximum recruitment limit of ${maxAllowed} employees. Please increase their limit or select another manager.`
        );
        err.statusCode = 400;
        throw err;
      }

      managerRef = managerDoc._id;
    } else {
      const err = new Error('Only Super Admin and Managers are authorized to create employees');
      err.statusCode = 403;
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

    const employeeProfile = new Employee({
      user: user._id,
      employeeCode: profileData.employeeCode || `EMP-${Date.now()}`,
      designation: profileData.designation || 'Staff Associate',
      department: profileData.department || managerDoc?.department || 'Operations',
      manager: managerRef
    });

    await employeeProfile.save();

    // Link employee to manager's managedEmployees list
    await Manager.findByIdAndUpdate(managerRef, {
      $addToSet: { managedEmployees: employeeProfile._id }
    });

    user.profile = employeeProfile._id;
    await user.save();

    return await User.findById(user._id)
      .populate({
        path: 'profile',
        populate: {
          path: 'manager',
          select: 'department branch maxTeamSize user',
          populate: { path: 'user', select: 'firstName lastName email phoneNumber' }
        }
      })
      .populate('createdBy', 'firstName lastName email role');
  }

  /**
   * Update Employee user and profile
   * - Managers can only update employees within their managed team and CANNOT reassign their manager.
   * - Super Admin can update any employee and reassign them to another manager (enforcing team limit).
   */
  async updateEmployee(userId, { userData = {}, profileData = {} }, updaterUser = null) {
    const user = await User.findById(userId);
    if (!user || user.role !== ROLES.EMPLOYEE) {
      const err = new Error('Employee not found');
      err.statusCode = 404;
      throw err;
    }

    const currentProfile = await Employee.findOne({ user: userId });
    if (!currentProfile) {
      const err = new Error('Employee profile not found');
      err.statusCode = 404;
      throw err;
    }

    // Role scoping: If updater is a MANAGER, ensure the employee belongs to their team
    if (updaterUser && updaterUser.role === ROLES.MANAGER) {
      const managerDoc = await Manager.findOne({ user: updaterUser._id });
      if (
        !managerDoc ||
        !currentProfile.manager ||
        String(currentProfile.manager) !== String(managerDoc._id)
      ) {
        const err = new Error(
          'Access denied. You can only manage employees belonging to your managed team.'
        );
        err.statusCode = 403;
        throw err;
      }

      // A manager CANNOT reassign an employee to another manager
      if (profileData.manager !== undefined || profileData.managerId !== undefined) {
        delete profileData.manager;
        delete profileData.managerId;
      }
    }

    // Super Admin reassigning employee to a different manager
    if (
      updaterUser &&
      updaterUser.role === ROLES.SUPER_ADMIN &&
      (profileData.manager || profileData.managerId)
    ) {
      const targetManagerInput = profileData.manager || profileData.managerId;
      const newManagerDoc = await this.resolveManager(targetManagerInput);
      if (!newManagerDoc) {
        const err = new Error(`Selected manager with ID '${targetManagerInput}' was not found`);
        err.statusCode = 404;
        throw err;
      }

      if (newManagerDoc.user && !newManagerDoc.user.isActive) {
        const err = new Error(
          `Selected manager '${newManagerDoc.user.firstName} ${newManagerDoc.user.lastName}' is inactive. Cannot assign employees to an inactive manager.`
        );
        err.statusCode = 400;
        throw err;
      }

      // Check if reassigning to a different manager
      if (!currentProfile.manager || String(currentProfile.manager) !== String(newManagerDoc._id)) {
        // Enforce team limit on new manager
        const newTeamSize = newManagerDoc.managedEmployees
          ? newManagerDoc.managedEmployees.length
          : 0;
        const maxAllowed = newManagerDoc.maxTeamSize || 20;

        if (newTeamSize >= maxAllowed) {
          const managerName = newManagerDoc.user
            ? `${newManagerDoc.user.firstName} ${newManagerDoc.user.lastName}`
            : 'New manager';
          const err = new Error(
            `Manager '${managerName}' has reached their maximum recruitment limit of ${maxAllowed} employees. Please increase their limit or select another manager.`
          );
          err.statusCode = 400;
          throw err;
        }

        // Pull from old manager
        if (currentProfile.manager) {
          await Manager.findByIdAndUpdate(currentProfile.manager, {
            $pull: { managedEmployees: currentProfile._id }
          });
        }

        // Add to new manager
        await Manager.findByIdAndUpdate(newManagerDoc._id, {
          $addToSet: { managedEmployees: currentProfile._id }
        });

        profileData.manager = newManagerDoc._id;
      } else {
        profileData.manager = newManagerDoc._id;
      }
    }

    // Update user base fields
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
      await Employee.findOneAndUpdate(
        { user: userId },
        { $set: profileData },
        { new: true, runValidators: true }
      );
    }

    return await User.findById(userId)
      .populate({
        path: 'profile',
        populate: {
          path: 'manager',
          select: 'department branch maxTeamSize user',
          populate: { path: 'user', select: 'firstName lastName email phoneNumber' }
        }
      })
      .populate('createdBy', 'firstName lastName email role');
  }

  /**
   * Delete Employee user and profile
   * - Managers can only delete employees belonging to their managed team.
   */
  async deleteEmployee(userId, deleterUser = null) {
    const user = await User.findById(userId);
    if (!user || user.role !== ROLES.EMPLOYEE) {
      const err = new Error('Employee not found');
      err.statusCode = 404;
      throw err;
    }

    const employeeProfile = await Employee.findOne({ user: userId });
    if (employeeProfile) {
      // If deleter is MANAGER, verify employee belongs to their team
      if (deleterUser && deleterUser.role === ROLES.MANAGER) {
        const managerDoc = await Manager.findOne({ user: deleterUser._id });
        if (
          !managerDoc ||
          !employeeProfile.manager ||
          String(employeeProfile.manager) !== String(managerDoc._id)
        ) {
          const err = new Error(
            'Access denied. You can only delete employees belonging to your managed team.'
          );
          err.statusCode = 403;
          throw err;
        }
      }

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
   * - Managers can only view employees in their managed team.
   */
  async getProfileByUserId(userId, requestingUser = null) {
    const employee = await Employee.findOne({ user: userId })
      .populate('user', 'firstName lastName email phoneNumber isActive role createdBy createdAt')
      .populate({
        path: 'manager',
        select: 'department branch maxTeamSize user',
        populate: { path: 'user', select: 'firstName lastName email phoneNumber' }
      });

    if (!employee) {
      const err = new Error('Employee profile not found');
      err.statusCode = 404;
      throw err;
    }

    // If requester is a Manager, verify this employee belongs to their team
    if (requestingUser && requestingUser.role === ROLES.MANAGER) {
      const managerDoc = await Manager.findOne({ user: requestingUser._id });
      if (
        !managerDoc ||
        !employee.manager ||
        String(employee.manager._id || employee.manager) !== String(managerDoc._id)
      ) {
        const err = new Error(
          'Access denied. You can only view employees belonging to your managed team.'
        );
        err.statusCode = 403;
        throw err;
      }
    }

    return employee;
  }

  /**
   * List employees
   * - If requester is MANAGER: returns ONLY employees in their managed team.
   * - If requester is SUPER_ADMIN: returns all employees, with optional filter by manager.
   */
  async getAllEmployees(queryFilter = {}, requestingUser = null) {
    const filter = {};

    // 1. If requester is a MANAGER, restrict to their managed employees only
    if (requestingUser && requestingUser.role === ROLES.MANAGER) {
      const managerDoc = await Manager.findOne({ user: requestingUser._id });
      if (!managerDoc) {
        return [];
      }
      filter.manager = managerDoc._id;
    }
    // 2. If requester is SUPER_ADMIN, allow filtering by manager if provided
    else if (queryFilter.manager || queryFilter.managerId) {
      const targetManager = await this.resolveManager(
        queryFilter.manager || queryFilter.managerId
      );
      if (targetManager) {
        filter.manager = targetManager._id;
      }
    }

    if (queryFilter.department) {
      filter.department = { $regex: new RegExp(queryFilter.department, 'i') };
    }

    if (queryFilter.designation) {
      filter.designation = { $regex: new RegExp(queryFilter.designation, 'i') };
    }

    return await Employee.find(filter)
      .populate('user', 'firstName lastName email phoneNumber isActive role createdAt')
      .populate({
        path: 'manager',
        select: 'department branch maxTeamSize user',
        populate: { path: 'user', select: 'firstName lastName email phoneNumber' }
      })
      .sort({ createdAt: -1 });
  }
}

export default new EmployeeService();
