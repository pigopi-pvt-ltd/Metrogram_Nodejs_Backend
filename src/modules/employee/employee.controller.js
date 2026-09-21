import employeeService from './employee.service.js';

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
        manager
      } = req.body;

      const newEmployee = await employeeService.createEmployee({
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
        manager
      } = req.body;

      const userData = {};
      if (firstName !== undefined) userData.firstName = firstName;
      if (lastName !== undefined) userData.lastName = lastName;
      if (email !== undefined) userData.email = email;
      if (password) userData.password = password;
      if (phoneNumber !== undefined) userData.phoneNumber = phoneNumber;
      if (isActive !== undefined) userData.isActive = isActive;

      const profileData = {};
      if (employeeCode !== undefined) profileData.employeeCode = employeeCode;
      if (designation !== undefined) profileData.designation = designation;
      if (department !== undefined) profileData.department = department;
      if (manager !== undefined) profileData.manager = manager;

      const updated = await employeeService.updateEmployee(req.params.userId, {
        userData,
        profileData
      });

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
      const result = await employeeService.deleteEmployee(req.params.userId);
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
      const profile = await employeeService.getProfileByUserId(req.params.userId || req.user._id);
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
      next(error);
    }
  }

  async getAll(req, res, next) {
    try {
      const employees = await employeeService.getAllEmployees();
      res.status(200).json({
        success: true,
        data: employees
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new EmployeeController();
