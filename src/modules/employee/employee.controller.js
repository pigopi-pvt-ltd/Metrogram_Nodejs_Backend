import employeeService from './employee.service.js';
import { uploadProfileImageToCloudinary } from '../../config/cloudinary.js';
import { extractUploadedProfileImage } from '../../middleware/upload.js';

class EmployeeController {
  async create(req, res, next) {
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
        manager,
        managerId
      } = req.body;

      let profileImageUrl = req.body.profileImage || null;
      let profileImagePublicId = req.body.profileImagePublicId || null;

      const profileImageFile = extractUploadedProfileImage(req);
      if (profileImageFile) {
        const uploadRes = await uploadProfileImageToCloudinary(profileImageFile.buffer);
        profileImageUrl = uploadRes.secure_url;
        profileImagePublicId = uploadRes.public_id;
      }

      const newEmployee = await employeeService.createEmployee({
        userData: {
          firstName,
          lastName,
          email,
          password,
          phoneNumber,
          profileImage: profileImageUrl,
          profileImagePublicId
        },
        profileData: {
          employeeCode,
          designation,
          department,
          manager: manager || managerId
        },
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

  async update(req, res, next) {
    try {
      const {
        firstName,
        lastName,
        email,
        password,
        phoneNumber,
        isActive,
        employeeCode,
        designation,
        department,
        manager,
        managerId
      } = req.body;

      const userData = {};
      if (firstName !== undefined) userData.firstName = firstName;
      if (lastName !== undefined) userData.lastName = lastName;
      if (email !== undefined) userData.email = email;
      if (password) userData.password = password;
      if (phoneNumber !== undefined) userData.phoneNumber = phoneNumber;
      if (isActive !== undefined) userData.isActive = isActive;

      const profileImageFile = extractUploadedProfileImage(req);
      if (profileImageFile) {
        const uploadRes = await uploadProfileImageToCloudinary(profileImageFile.buffer);
        userData.profileImage = uploadRes.secure_url;
        userData.profileImagePublicId = uploadRes.public_id;
      } else if (req.body.profileImage !== undefined) {
        userData.profileImage = req.body.profileImage;
        userData.profileImagePublicId = req.body.profileImagePublicId || null;
      }

      const profileData = {};
      if (employeeCode !== undefined) profileData.employeeCode = employeeCode;
      if (designation !== undefined) profileData.designation = designation;
      if (department !== undefined) profileData.department = department;
      if (manager !== undefined || managerId !== undefined) {
        profileData.manager = manager || managerId;
      }

      const updated = await employeeService.updateEmployee(
        req.params.userId,
        {
          userData,
          profileData
        },
        req.user
      );

      res.status(200).json({
        success: true,
        message: 'Employee updated successfully',
        data: updated
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

  async delete(req, res, next) {
    try {
      const result = await employeeService.deleteEmployee(req.params.userId, req.user);
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

  async getProfile(req, res, next) {
    try {
      const targetUserId = req.params.userId || req.user._id;
      const profile = await employeeService.getProfileByUserId(targetUserId, req.user);
      if (!profile) {
        return res.status(404).json({
          success: false,
          message: 'Employee profile not found'
        });
      }
      res.status(200).json({
        success: true,
        data: profile
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

  async getAll(req, res, next) {
    try {
      const employees = await employeeService.getAllEmployees(req.query, req.user);
      res.status(200).json({
        success: true,
        data: employees
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

  async updateProfileImage(req, res, next) {
    try {
      const targetUserId = req.params.userId || req.user._id;
      const file = extractUploadedProfileImage(req);
      let profileImageUrl = req.body.profileImage || null;
      let profileImagePublicId = req.body.profileImagePublicId || null;

      if (file) {
        const uploadRes = await uploadProfileImageToCloudinary(file.buffer);
        profileImageUrl = uploadRes.secure_url;
        profileImagePublicId = uploadRes.public_id;
      }

      if (!profileImageUrl) {
        return res.status(400).json({
          success: false,
          message: 'Please provide an image file (field: profileImage) or a profileImage URL'
        });
      }

      const updated = await employeeService.updateEmployee(
        targetUserId,
        {
          userData: {
            profileImage: profileImageUrl,
            profileImagePublicId
          },
          profileData: {}
        },
        req.user
      );

      res.status(200).json({
        success: true,
        message: 'Employee profile image updated successfully',
        data: updated
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
}

export default new EmployeeController();
