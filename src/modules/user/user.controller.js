import userService from './user.service.js';
import { ROLES } from '../../constants/roles.js';
import { uploadBufferToCloudinary } from '../../config/cloudinary.js';

class UserController {
  /**
   * Generic Create User endpoint
   */
  async createUser(req, res, next) {
    try {
      const {
        firstName,
        lastName,
        email,
        password,
        phoneNumber,
        role,
        profile = {}
      } = req.body;

      if (!role) {
        return res.status(400).json({
          success: false,
          message: 'Role is required (MANAGER, EMPLOYEE, or CUSTOMER)'
        });
      }

      const newUser = await userService.createUserByRole({
        role,
        userData: { firstName, lastName, email, password, phoneNumber },
        profileData: profile,
        creatorId: req.user._id,
        creatorRole: req.user.role
      });

      res.status(201).json({
        success: true,
        message: `${newUser.role} created successfully`,
        data: newUser
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Dedicated Create Manager
   */
  async createManager(req, res, next) {
    try {
      const {
        firstName,
        lastName,
        email,
        password,
        phoneNumber,
        department,
        branch,
        maxTeamSize
      } = req.body;

      const newManager = await userService.createUserByRole({
        role: ROLES.MANAGER,
        userData: { firstName, lastName, email, password, phoneNumber },
        profileData: { department, branch, maxTeamSize },
        creatorId: req.user._id,
        creatorRole: req.user.role
      });

      res.status(201).json({
        success: true,
        message: 'Manager created successfully',
        data: newManager
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Dedicated Create Employee
   */
  async createEmployee(req, res, next) {
    try {
      const {
        firstName,
        lastName,
        email,
        password,
        phoneNumber,
        employeeCode,
        designation,
        department,
        manager
      } = req.body;

      const newEmployee = await userService.createUserByRole({
        role: ROLES.EMPLOYEE,
        userData: { firstName, lastName, email, password, phoneNumber },
        profileData: { employeeCode, designation, department, manager },
        creatorId: req.user._id,
        creatorRole: req.user.role
      });

      res.status(201).json({
        success: true,
        message: 'Employee created successfully',
        data: newEmployee
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Dedicated Create Customer
   */
  async createCustomer(req, res, next) {
    try {
      const {
        firstName,
        lastName,
        email,
        password,
        phoneNumber,
        customerCode,
        membershipType,
        aadharNumber,
        panNumber,
        address,
        loyaltyPoints
      } = req.body;

      let parsedAddress = address;
      if (typeof address === 'string') {
        try {
          parsedAddress = JSON.parse(address);
        } catch {
          parsedAddress = { street: address };
        }
      }

      let aadharImageUrl = req.body.aadharImage || null;
      let aadharImagePublicId = req.body.aadharImagePublicId || null;
      let panImageUrl = req.body.panImage || null;
      let panImagePublicId = req.body.panImagePublicId || null;

      if (req.files) {
        if (req.files.aadharImage && req.files.aadharImage[0]) {
          const file = req.files.aadharImage[0];
          const uploadRes = await uploadBufferToCloudinary(file.buffer, {
            folder: 'metrogram/customers/aadhar',
            public_id: `aadhar_${Date.now()}`
          });
          aadharImageUrl = uploadRes.secure_url;
          aadharImagePublicId = uploadRes.public_id;
        }

        if (req.files.panImage && req.files.panImage[0]) {
          const file = req.files.panImage[0];
          const uploadRes = await uploadBufferToCloudinary(file.buffer, {
            folder: 'metrogram/customers/pan',
            public_id: `pan_${Date.now()}`
          });
          panImageUrl = uploadRes.secure_url;
          panImagePublicId = uploadRes.public_id;
        }
      }

      const newCustomer = await userService.createUserByRole({
        role: ROLES.CUSTOMER,
        userData: { firstName, lastName, email, password, phoneNumber },
        profileData: {
          customerCode,
          membershipType,
          aadharNumber,
          aadharImage: aadharImageUrl,
          aadharImagePublicId,
          panNumber,
          panImage: panImageUrl,
          panImagePublicId,
          address: parsedAddress,
          loyaltyPoints
        },
        creatorId: req.user._id,
        creatorRole: req.user.role
      });

      res.status(201).json({
        success: true,
        message: 'Customer created successfully',
        data: newCustomer
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Update User
   */
  async updateUser(req, res, next) {
    try {
      const {
        firstName,
        lastName,
        email,
        password,
        phoneNumber,
        isActive,
        profile = {},
        ...rest
      } = req.body;

      const userData = {};
      if (firstName !== undefined) userData.firstName = firstName;
      if (lastName !== undefined) userData.lastName = lastName;
      if (email !== undefined) userData.email = email;
      if (password) userData.password = password;
      if (phoneNumber !== undefined) userData.phoneNumber = phoneNumber;
      if (isActive !== undefined) userData.isActive = isActive;

      const profileData = { ...profile, ...rest };

      const updatedUser = await userService.updateUser(req.params.id, {
        userData,
        profileData,
        updaterRole: req.user.role,
        updaterId: req.user._id
      });

      res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: updatedUser
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Delete User
   */
  async deleteUser(req, res, next) {
    try {
      const result = await userService.deleteUser(req.params.id, {
        deleterRole: req.user.role,
        deleterId: req.user._id
      });

      res.status(200).json(result);
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Toggle Active / Inactive Status
   */
  async toggleStatus(req, res, next) {
    try {
      const { isActive } = req.body;
      const user = await userService.toggleStatus(req.params.id, {
        isActive,
        updaterRole: req.user.role,
        updaterId: req.user._id
      });

      res.status(200).json({
        success: true,
        message: `User status changed to ${user.isActive ? 'Active' : 'Inactive'}`,
        data: user
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * List Users
   */
  async getAllUsers(req, res, next) {
    try {
      const { role, search, page, limit } = req.query;
      const result = await userService.getAllUsers({ role, search, page, limit });

      res.status(200).json({
        success: true,
        count: result.users.length,
        total: result.total,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        data: result.users
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get User by ID
   */
  async getUserById(req, res, next) {
    try {
      const user = await userService.getUserById(req.params.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: `User not found with id: ${req.params.id}`
        });
      }
      res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new UserController();
