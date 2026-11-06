import managerService from './manager.service.js';
import { uploadProfileImageToCloudinary } from '../../config/cloudinary.js';
import { extractUploadedProfileImage } from '../../middleware/upload.js';

class ManagerController {
  async create(req, res, next) {
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

      let profileImageUrl = req.body.profileImage || null;
      let profileImagePublicId = req.body.profileImagePublicId || null;

      const profileImageFile = extractUploadedProfileImage(req);
      if (profileImageFile) {
        const uploadRes = await uploadProfileImageToCloudinary(profileImageFile.buffer);
        profileImageUrl = uploadRes.secure_url;
        profileImagePublicId = uploadRes.public_id;
      }

      const newManager = await managerService.createManager({
        userData: {
          firstName,
          lastName,
          email,
          password,
          phoneNumber,
          profileImage: profileImageUrl,
          profileImagePublicId
        },
        profileData: { department, branch, maxTeamSize },
        creatorId: req.user._id
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

  async update(req, res, next) {
    try {
      const {
        firstName,
        lastName,
        email,
        password,
        phoneNumber,
        isActive,
        department,
        branch,
        maxTeamSize
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
      if (department !== undefined) profileData.department = department;
      if (branch !== undefined) profileData.branch = branch;
      if (maxTeamSize !== undefined) profileData.maxTeamSize = maxTeamSize;

      const updated = await managerService.updateManager(req.params.userId, {
        userData,
        profileData
      });

      res.status(200).json({
        success: true,
        message: 'Manager updated successfully',
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
      const result = await managerService.deleteManager(req.params.userId);
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
      const profile = await managerService.getProfileByUserId(req.params.userId || req.user._id);
      if (!profile) {
        return res.status(404).json({
          success: false,
          message: 'Manager profile not found'
        });
      }
      res.status(200).json({
        success: true,
        data: profile
      });
    } catch (error) {
      next(error);
    }
  }

  async getAll(req, res, next) {
    try {
      const managers = await managerService.getAllManagers();
      res.status(200).json({
        success: true,
        data: managers
      });
    } catch (error) {
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

      const updated = await managerService.updateManager(targetUserId, {
        userData: {
          profileImage: profileImageUrl,
          profileImagePublicId
        },
        profileData: {}
      });

      res.status(200).json({
        success: true,
        message: 'Manager profile image updated successfully',
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

export default new ManagerController();
