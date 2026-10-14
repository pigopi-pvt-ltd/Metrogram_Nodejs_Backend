import Customer from './customer.model.js';
import User from '../user/user.model.js';
import Employee from '../employee/employee.model.js';
import Manager from '../manager/manager.model.js';
import ServiceBooking from '../service/serviceBooking.model.js';
import { ROLES, PROFILE_MODELS } from '../../constants/roles.js';
import { deleteFromCloudinary } from '../../config/cloudinary.js';

class CustomerService {
  /**
   * Helper to resolve an Employee by User ID, Employee Profile ID, or employeeCode
   * Returns { employeeDoc, userDoc } or null
   */
  async resolveEmployee(employeeInput) {
    if (!employeeInput) return null;

    // 1. Try finding by User ID (where role is EMPLOYEE)
    let userDoc = await User.findOne({ _id: employeeInput, role: ROLES.EMPLOYEE });
    let employeeDoc = null;

    if (userDoc) {
      employeeDoc = await Employee.findOne({ user: userDoc._id });
      return { employeeDoc, userDoc };
    }

    // 2. Try finding by Employee Profile ID
    employeeDoc = await Employee.findById(employeeInput);
    if (employeeDoc && employeeDoc.user) {
      userDoc = await User.findById(employeeDoc.user);
      return { employeeDoc, userDoc };
    }

    // 3. Try finding by employeeCode
    employeeDoc = await Employee.findOne({ employeeCode: employeeInput });
    if (employeeDoc && employeeDoc.user) {
      userDoc = await User.findById(employeeDoc.user);
      return { employeeDoc, userDoc };
    }

    return null;
  }

  /**
   * Helper to resolve Customer document and linked User document
   */
  async resolveCustomer(customerInput) {
    if (!customerInput) return null;

    // 1. Check if customerInput is Customer profile _id
    let customerDoc = await Customer.findById(customerInput);
    let userDoc = null;

    if (customerDoc && customerDoc.user) {
      userDoc = await User.findById(customerDoc.user);
      return { customerDoc, userDoc };
    }

    // 2. Check if customerInput is User _id
    userDoc = await User.findOne({ _id: customerInput, role: ROLES.CUSTOMER });
    if (userDoc) {
      customerDoc = await Customer.findOne({ user: userDoc._id });
      return { customerDoc, userDoc };
    }

    // 3. Check by customerCode
    customerDoc = await Customer.findOne({ customerCode: customerInput });
    if (customerDoc && customerDoc.user) {
      userDoc = await User.findById(customerDoc.user);
      return { customerDoc, userDoc };
    }

    return null;
  }

  /**
   * Build MongoDB query filter for Customer model based on requesting user's role and hierarchy:
   * - Super Admin: No filter (can see all customers).
   * - Manager: Only customers registered by or assigned to employees under their management (and manager's direct customers).
   * - Employee: Only customers registered by or assigned to themselves.
   * - Customer: Only themselves.
   * - Self-registered customers (createdBy: null, assignedEmployee: null) do NOT fall under any employee or manager.
   */
  async buildCustomerScopeFilter(requestingUser) {
    if (!requestingUser) return { _id: null };

    if (requestingUser.role === ROLES.SUPER_ADMIN) {
      return {};
    }

    if (requestingUser.role === ROLES.EMPLOYEE) {
      const employeeUserId = requestingUser._id;

      // Find customer User documents created by this employee
      const createdUsers = await User.find({
        role: ROLES.CUSTOMER,
        createdBy: employeeUserId
      }).select('_id');
      const createdCustomerUserIds = createdUsers.map((u) => u._id);

      return {
        $or: [
          { assignedEmployee: employeeUserId },
          { user: { $in: createdCustomerUserIds } }
        ]
      };
    }

    if (requestingUser.role === ROLES.MANAGER) {
      const managerDoc = await Manager.findOne({ user: requestingUser._id });
      if (!managerDoc) {
        return { _id: null };
      }

      // Find all employees managed by this manager
      const managedEmployees = await Employee.find({ manager: managerDoc._id });
      const managedEmployeeUserIds = managedEmployees.map((e) => e.user);
      const allowedStaffIds = [...managedEmployeeUserIds, requestingUser._id];

      // Find customer User documents created by employees under this manager (or manager themselves)
      const createdUsers = await User.find({
        role: ROLES.CUSTOMER,
        createdBy: { $in: allowedStaffIds }
      }).select('_id');
      const createdCustomerUserIds = createdUsers.map((u) => u._id);

      return {
        $or: [
          { assignedEmployee: { $in: managedEmployeeUserIds } },
          { user: { $in: createdCustomerUserIds } }
        ]
      };
    }

    if (requestingUser.role === ROLES.CUSTOMER) {
      return { user: requestingUser._id };
    }

    return { _id: null };
  }

  /**
   * Verify whether requestingUser has permission to view, update, delete, or manage a specific customer
   * Throws 403 / 404 error if forbidden or not found.
   */
  async verifyCustomerAccess(customerIdentifier, requestingUser, action = 'view') {
    const resolved = await this.resolveCustomer(customerIdentifier);
    if (!resolved || !resolved.customerDoc || !resolved.userDoc) {
      const err = new Error('Customer not found');
      err.statusCode = 404;
      throw err;
    }

    const { customerDoc, userDoc } = resolved;
    if (!requestingUser) return resolved;

    // Super Admin has unrestricted access
    if (requestingUser.role === ROLES.SUPER_ADMIN) {
      return resolved;
    }

    // Customer can only access their own profile
    if (requestingUser.role === ROLES.CUSTOMER) {
      if (String(userDoc._id) !== String(requestingUser._id)) {
        const err = new Error("Forbidden: You are not authorized to access another customer's profile");
        err.statusCode = 403;
        throw err;
      }
      return resolved;
    }

    // Employee can ONLY access customers registered by them or assigned to them
    if (requestingUser.role === ROLES.EMPLOYEE) {
      const reqUserId = String(requestingUser._id);
      const isAssigned = customerDoc.assignedEmployee && String(customerDoc.assignedEmployee) === reqUserId;
      const isCreator = userDoc.createdBy && String(userDoc.createdBy) === reqUserId;

      if (!isAssigned && !isCreator) {
        const err = new Error(
          `Access denied. You can only ${action} customers registered by you or assigned to you.`
        );
        err.statusCode = 403;
        throw err;
      }
      return resolved;
    }

    // Manager can ONLY access customers registered by or assigned to employees under their management
    if (requestingUser.role === ROLES.MANAGER) {
      const managerDoc = await Manager.findOne({ user: requestingUser._id });
      if (!managerDoc) {
        const err = new Error('Manager profile not found');
        err.statusCode = 404;
        throw err;
      }

      const managedEmployees = await Employee.find({ manager: managerDoc._id });
      const managedEmployeeUserIds = managedEmployees.map((e) => String(e.user));
      const allowedStaffIds = [...managedEmployeeUserIds, String(requestingUser._id)];

      const isAssignedToTeam =
        customerDoc.assignedEmployee && managedEmployeeUserIds.includes(String(customerDoc.assignedEmployee));
      const isCreatedByTeam =
        userDoc.createdBy && allowedStaffIds.includes(String(userDoc.createdBy));

      if (!isAssignedToTeam && !isCreatedByTeam) {
        const err = new Error(
          `Access denied. You can only ${action} customers registered by or assigned to employees under your team.`
        );
        err.statusCode = 403;
        throw err;
      }
      return resolved;
    }

    const err = new Error(`Access denied to ${action} customer`);
    err.statusCode = 403;
    throw err;
  }

  /**
   * Super Admin assigns or reassigns an employee to a customer (especially self-registered customers)
   */
  async assignEmployee(customerIdentifier, employeeInput, requestingUser) {
    if (!requestingUser || requestingUser.role !== ROLES.SUPER_ADMIN) {
      const err = new Error('Only Super Admin can assign or reassign employees to customers');
      err.statusCode = 403;
      throw err;
    }

    const resolved = await this.resolveCustomer(customerIdentifier);
    if (!resolved || !resolved.customerDoc || !resolved.userDoc) {
      const err = new Error('Customer not found');
      err.statusCode = 404;
      throw err;
    }

    const { customerDoc, userDoc } = resolved;

    // If employeeInput is null, empty string, or 'none', unassign customer
    if (!employeeInput || employeeInput === 'none' || employeeInput === 'null') {
      customerDoc.assignedEmployee = null;
      await customerDoc.save();

      return await Customer.findById(customerDoc._id)
        .populate('user', 'firstName lastName email phoneNumber isActive role createdBy createdAt')
        .populate('assignedEmployee', 'firstName lastName email phoneNumber role')
        .populate('activeCard.cardPlan');
    }

    // Resolve employee
    const resolvedEmp = await this.resolveEmployee(employeeInput);
    if (!resolvedEmp || !resolvedEmp.userDoc || !resolvedEmp.employeeDoc) {
      const err = new Error(`Employee '${employeeInput}' not found`);
      err.statusCode = 404;
      throw err;
    }

    if (!resolvedEmp.userDoc.isActive) {
      const err = new Error(
        `Cannot assign customer to inactive employee '${resolvedEmp.userDoc.firstName} ${resolvedEmp.userDoc.lastName}'`
      );
      err.statusCode = 400;
      throw err;
    }

    customerDoc.assignedEmployee = resolvedEmp.userDoc._id;
    await customerDoc.save();

    return await Customer.findById(customerDoc._id)
      .populate('user', 'firstName lastName email phoneNumber isActive role createdBy createdAt')
      .populate({
        path: 'assignedEmployee',
        select: 'firstName lastName email phoneNumber role profile',
        populate: {
          path: 'profile',
          select: 'employeeCode designation department manager'
        }
      })
      .populate('activeCard.cardPlan');
  }

  /**
   * Create a Customer user and profile
   * - If registered by Employee: automatically assigned to that employee.
   * - If registered by Super Admin: can specify employee assignment or leave unassigned.
   * - If registered by Manager: can assign to an employee under their team or leave as manager direct.
   * - If registered by self (AuthService): createdBy is null and assignedEmployee is null.
   */
  async createCustomer({ userData, profileData = {}, creatorId = null, creatorRole = null }) {
    const existing = await User.findOne({ email: userData.email.toLowerCase() });
    if (existing) {
      const err = new Error('A user with this email address already exists');
      err.statusCode = 400;
      throw err;
    }

    let assignedEmployeeId = profileData.assignedEmployee || profileData.employeeId || null;

    if (creatorRole === ROLES.EMPLOYEE) {
      // Employee creating customer automatically assigns customer to themselves
      assignedEmployeeId = creatorId;
    } else if (!assignedEmployeeId && creatorId) {
      // If creatorRole was not provided, check creatorId role
      const creatorUser = await User.findById(creatorId);
      if (creatorUser && creatorUser.role === ROLES.EMPLOYEE) {
        assignedEmployeeId = creatorUser._id;
      }
    } else if (creatorRole === ROLES.MANAGER) {
      if (assignedEmployeeId) {
        // Verify this employee belongs to this manager's team
        const resolvedEmp = await this.resolveEmployee(assignedEmployeeId);
        if (!resolvedEmp || !resolvedEmp.employeeDoc) {
          const err = new Error('Selected employee not found');
          err.statusCode = 404;
          throw err;
        }

        const managerDoc = await Manager.findOne({ user: creatorId });
        if (
          !resolvedEmp.employeeDoc.manager ||
          String(resolvedEmp.employeeDoc.manager) !== String(managerDoc?._id)
        ) {
          const err = new Error(
            'Access denied. You can only assign customers to employees belonging to your team.'
          );
          err.statusCode = 403;
          throw err;
        }

        assignedEmployeeId = resolvedEmp.userDoc._id;
      }
    } else if (creatorRole === ROLES.SUPER_ADMIN) {
      if (assignedEmployeeId) {
        const resolvedEmp = await this.resolveEmployee(assignedEmployeeId);
        if (!resolvedEmp || !resolvedEmp.userDoc) {
          const err = new Error('Selected employee not found');
          err.statusCode = 404;
          throw err;
        }
        if (!resolvedEmp.userDoc.isActive) {
          const err = new Error('Cannot assign customer to an inactive employee');
          err.statusCode = 400;
          throw err;
        }
        assignedEmployeeId = resolvedEmp.userDoc._id;
      }
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
      assignedEmployee: assignedEmployeeId,
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
      .populate({
        path: 'profile',
        populate: [
          { path: 'assignedEmployee', select: 'firstName lastName email phoneNumber role' },
          { path: 'activeCard.cardPlan' }
        ]
      })
      .populate('createdBy', 'firstName lastName email role');
  }

  /**
   * Update Customer user and profile
   * - Enforces team isolation and ownership
   * - Super Admin can assign/reassign employee
   * - Manager can only assign to employees in their team
   * - Employees cannot reassign customers
   */
  async updateCustomer(userId, { userData = {}, profileData = {} }, updaterUser = null) {
    // Verify customer access permission
    const { customerDoc, userDoc } = await this.verifyCustomerAccess(userId, updaterUser, 'update');
    const targetUserId = userDoc._id;

    // Handle employee assignment changes
    const employeeInput = profileData.assignedEmployee !== undefined ? profileData.assignedEmployee : profileData.employeeId;
    if (employeeInput !== undefined) {
      if (updaterUser && updaterUser.role === ROLES.SUPER_ADMIN) {
        if (!employeeInput || employeeInput === 'none' || employeeInput === 'null') {
          profileData.assignedEmployee = null;
        } else {
          const resolvedEmp = await this.resolveEmployee(employeeInput);
          if (!resolvedEmp || !resolvedEmp.userDoc) {
            const err = new Error(`Employee '${employeeInput}' not found`);
            err.statusCode = 404;
            throw err;
          }
          if (!resolvedEmp.userDoc.isActive) {
            const err = new Error('Cannot assign customer to an inactive employee');
            err.statusCode = 400;
            throw err;
          }
          profileData.assignedEmployee = resolvedEmp.userDoc._id;
        }
      } else if (updaterUser && updaterUser.role === ROLES.MANAGER) {
        if (employeeInput && employeeInput !== 'none') {
          const resolvedEmp = await this.resolveEmployee(employeeInput);
          if (!resolvedEmp || !resolvedEmp.employeeDoc) {
            const err = new Error('Selected employee not found');
            err.statusCode = 404;
            throw err;
          }
          const managerDoc = await Manager.findOne({ user: updaterUser._id });
          if (
            !resolvedEmp.employeeDoc.manager ||
            String(resolvedEmp.employeeDoc.manager) !== String(managerDoc?._id)
          ) {
            const err = new Error(
              'Access denied. You can only assign customers to employees belonging to your team.'
            );
            err.statusCode = 403;
            throw err;
          }
          profileData.assignedEmployee = resolvedEmp.userDoc._id;
        }
      } else {
        // Employees and customers cannot modify assignedEmployee
        delete profileData.assignedEmployee;
      }
      delete profileData.employeeId;
    }

    if (userData.firstName) userDoc.firstName = userData.firstName;
    if (userData.lastName) userDoc.lastName = userData.lastName;
    if (userData.phoneNumber !== undefined) userDoc.phoneNumber = userData.phoneNumber;
    if (userData.isActive !== undefined && (!updaterUser || updaterUser.role !== ROLES.CUSTOMER)) {
      userDoc.isActive = userData.isActive;
    }
    if (userData.password) {
      userDoc.password = userData.password;
    }

    if (userData.email && userData.email.toLowerCase() !== userDoc.email) {
      const existing = await User.findOne({ email: userData.email.toLowerCase() });
      if (existing) {
        const err = new Error('Email is already in use by another user');
        err.statusCode = 400;
        throw err;
      }
      userDoc.email = userData.email.toLowerCase();
    }

    await userDoc.save();

    if (Object.keys(profileData).length > 0) {
      await Customer.findOneAndUpdate(
        { user: targetUserId },
        { $set: profileData },
        { new: true, runValidators: true }
      );
    }

    return await User.findById(targetUserId)
      .populate({
        path: 'profile',
        populate: [
          { path: 'assignedEmployee', select: 'firstName lastName email phoneNumber role' },
          { path: 'activeCard.cardPlan' }
        ]
      })
      .populate('createdBy', 'firstName lastName email role');
  }

  /**
   * Delete Customer user and profile
   * Enforces role isolation (Employees can only delete their own customers; Managers can only delete their team's customers)
   */
  async deleteCustomer(userId, deleterUser = null) {
    const { customerDoc, userDoc } = await this.verifyCustomerAccess(userId, deleterUser, 'delete');

    if (customerDoc) {
      if (customerDoc.aadharImagePublicId) {
        deleteFromCloudinary(customerDoc.aadharImagePublicId).catch((err) => {
          console.error('[Cloudinary] Failed to delete Aadhar document:', err.message);
        });
      }
      if (customerDoc.panImagePublicId) {
        deleteFromCloudinary(customerDoc.panImagePublicId).catch((err) => {
          console.error('[Cloudinary] Failed to delete PAN document:', err.message);
        });
      }
      await Customer.findByIdAndDelete(customerDoc._id);
    }

    await User.findByIdAndDelete(userDoc._id);

    return { success: true, message: 'Customer and associated profile deleted successfully' };
  }

  /**
   * Get Customer Profile by User ID or Customer Profile ID
   * Enforces access control based on requestingUser
   */
  async getProfileByUserId(userId, requestingUser = null) {
    const resolved = await this.verifyCustomerAccess(userId, requestingUser, 'view');
    return await Customer.findById(resolved.customerDoc._id)
      .populate('user', 'firstName lastName email phoneNumber isActive role createdBy createdAt')
      .populate({
        path: 'assignedEmployee',
        select: 'firstName lastName email phoneNumber role profile',
        populate: {
          path: 'profile',
          select: 'employeeCode designation department manager'
        }
      })
      .populate('activeCard.cardPlan');
  }

  /**
   * List customers with role scoping, search, filters, and pagination:
   * - Super Admin sees all (with optional ?unassigned=true / ?employee=<id> / ?manager=<id> filters)
   * - Manager sees only customers registered by or assigned to employees in their team
   * - Employee sees only customers registered by or assigned to themselves
   */
  async getAllCustomers(queryParams = {}, requestingUser = null) {
    // 1. Role-based scoping filter
    const baseFilter = await this.buildCustomerScopeFilter(requestingUser);

    const conditions = [];
    if (Object.keys(baseFilter).length > 0) {
      conditions.push(baseFilter);
    }

    const {
      search,
      membershipType,
      hasCard,
      unassigned,
      selfRegistered,
      assigned,
      employee,
      employeeId,
      manager,
      managerId,
      page,
      limit
    } = queryParams;

    // 2. Search by name, email, phone, or customer code
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const matchedUsers = await User.find({
        role: ROLES.CUSTOMER,
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { phoneNumber: searchRegex }
        ]
      }).select('_id');

      conditions.push({
        $or: [
          { user: { $in: matchedUsers.map((u) => u._id) } },
          { customerCode: searchRegex },
          { aadharNumber: searchRegex },
          { panNumber: searchRegex }
        ]
      });
    }

    // 3. Filter by membershipType
    if (membershipType) {
      conditions.push({ membershipType: membershipType.toUpperCase() });
    }

    // 4. Filter by hasCard
    if (hasCard !== undefined) {
      conditions.push({ hasCard: String(hasCard) === 'true' });
    }

    // 5. Filter for self-registered / unassigned customers (Super Admin capability)
    if (String(unassigned) === 'true' || String(selfRegistered) === 'true') {
      const selfRegUsers = await User.find({
        role: ROLES.CUSTOMER,
        createdBy: null
      }).select('_id');
      const selfRegUserIds = selfRegUsers.map((u) => u._id);

      conditions.push({
        assignedEmployee: null,
        user: { $in: selfRegUserIds }
      });
    }

    // 6. Filter for assigned customers
    if (String(assigned) === 'true') {
      conditions.push({ assignedEmployee: { $ne: null } });
    }

    // 7. Filter by specific employee (Super Admin or Manager)
    const targetEmpInput = employee || employeeId;
    if (targetEmpInput) {
      const resolvedEmp = await this.resolveEmployee(targetEmpInput);
      if (resolvedEmp && resolvedEmp.userDoc) {
        conditions.push({
          $or: [
            { assignedEmployee: resolvedEmp.userDoc._id },
            { user: { $in: (await User.find({ role: ROLES.CUSTOMER, createdBy: resolvedEmp.userDoc._id }).select('_id')).map(u => u._id) } }
          ]
        });
      }
    }

    // 8. Filter by manager (Super Admin only)
    const targetMgrInput = manager || managerId;
    if (targetMgrInput && (!requestingUser || requestingUser.role === ROLES.SUPER_ADMIN)) {
      let managerDoc = await Manager.findById(targetMgrInput);
      if (!managerDoc) {
        managerDoc = await Manager.findOne({ user: targetMgrInput });
      }
      if (managerDoc) {
        const teamEmployees = await Employee.find({ manager: managerDoc._id });
        const teamUserIds = teamEmployees.map((e) => e.user);
        const teamCustomerUsers = await User.find({
          role: ROLES.CUSTOMER,
          createdBy: { $in: [...teamUserIds, managerDoc.user] }
        }).select('_id');
        const teamCustomerUserIds = teamCustomerUsers.map((u) => u._id);

        conditions.push({
          $or: [
            { assignedEmployee: { $in: teamUserIds } },
            { user: { $in: teamCustomerUserIds } }
          ]
        });
      }
    }

    const finalQuery = conditions.length === 0 ? {} : (conditions.length === 1 ? conditions[0] : { $and: conditions });

    // Handle pagination if requested
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const isPaginated = !isNaN(pageNum) && pageNum > 0 && !isNaN(limitNum) && limitNum > 0;

    let queryExec = Customer.find(finalQuery)
      .populate('user', 'firstName lastName email phoneNumber isActive role createdBy createdAt')
      .populate({
        path: 'assignedEmployee',
        select: 'firstName lastName email phoneNumber role profile',
        populate: {
          path: 'profile',
          select: 'employeeCode designation department manager'
        }
      })
      .populate('activeCard.cardPlan')
      .sort({ createdAt: -1 });

    const formatCustomers = async (list) => {
      for (const cust of list) {
        if (!cust.assignedEmployee && cust.user && cust.user.createdBy) {
          const creator =
            typeof cust.user.createdBy === 'object' && cust.user.createdBy._id
              ? cust.user.createdBy
              : await User.findById(cust.user.createdBy).select('firstName lastName email phoneNumber role');
          if (creator && creator.role === ROLES.EMPLOYEE) {
            cust.assignedEmployee = creator;
          }
        }
      }
      return list;
    };

    if (isPaginated) {
      const skip = (pageNum - 1) * limitNum;
      const [rawCustomers, total] = await Promise.all([
        queryExec.skip(skip).limit(limitNum),
        Customer.countDocuments(finalQuery)
      ]);

      const customers = await formatCustomers(rawCustomers);

      return {
        customers,
        total,
        totalPages: Math.ceil(total / limitNum),
        currentPage: pageNum,
        limit: limitNum
      };
    }

    const rawCustomers = await queryExec;
    const customers = await formatCustomers(rawCustomers);

    return {
      customers,
      total: customers.length,
      totalPages: 1,
      currentPage: 1,
      limit: customers.length
    };
  }

  /**
   * Auto-sync to ensure any legacy customer created by an employee has assignedEmployee set
   */
  async syncCustomerAssignedEmployees() {
    try {
      const unassignedCustomers = await Customer.find({ assignedEmployee: null }).populate('user');
      let updatedCount = 0;
      for (const cust of unassignedCustomers) {
        if (cust.user && cust.user.createdBy) {
          const creator = await User.findById(cust.user.createdBy);
          if (creator && creator.role === ROLES.EMPLOYEE) {
            cust.assignedEmployee = creator._id;
            await cust.save();
            updatedCount++;
          }
        }
      }
      if (updatedCount > 0) {
        console.log(`[CustomerService] Auto-synced ${updatedCount} legacy customer records with assignedEmployee.`);
      }
      return updatedCount;
    } catch (err) {
      console.error('[CustomerService] Failed to auto-sync assigned employees:', err.message);
      return 0;
    }
  }

  /**
   * Get all test bookings for a specific customer
   * Enforces role isolation access verification
   */
  async getCustomerBookings(userIdOrProfileId, { page = 1, limit = 20, status } = {}, requestingUser = null) {
    const resolved = await this.verifyCustomerAccess(userIdOrProfileId, requestingUser, 'view bookings of');
    const targetUserId = resolved.userDoc._id;

    const filter = { customer: targetUserId };
    if (status) filter.bookingStatus = status;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [bookings, total, customerUser] = await Promise.all([
      ServiceBooking.find(filter)
        .populate('customer', 'firstName lastName email phoneNumber')
        .populate('service')
        .populate('payment')
        .populate('handledBy', 'firstName lastName email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      ServiceBooking.countDocuments(filter),
      User.findById(targetUserId).select('firstName lastName email phoneNumber').populate('profile')
    ]);

    return {
      customer: customerUser,
      bookings,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      limit: limitNum
    };
  }
}

export default new CustomerService();
