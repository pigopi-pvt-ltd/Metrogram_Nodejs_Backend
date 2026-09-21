import managerService from './manager.service.js';

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

      const newManager = await managerService.createManager({
        userData: { firstName, lastName, email, password, phoneNumber },
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
}

export default new ManagerController();
