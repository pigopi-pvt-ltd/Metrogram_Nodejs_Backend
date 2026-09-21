import customerService from './customer.service.js';

class CustomerController {
  async create(req, res, next) {
    try {
      const {
        firstName,
        lastName,
        email,
        password,
        phoneNumber,
        customerCode,
        membershipType,
        address,
        loyaltyPoints
      } = req.body;

      const newCustomer = await customerService.createCustomer({
        userData: { firstName, lastName, email, password, phoneNumber },
        profileData: { customerCode, membershipType, address, loyaltyPoints },
        creatorId: req.user._id
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

  async update(req, res, next) {
    try {
      const {
        firstName,
        lastName,
        email,
        password,
        phoneNumber,
        isActive,
        customerCode,
        membershipType,
        address,
        loyaltyPoints
      } = req.body;

      const userData = {};
      if (firstName !== undefined) userData.firstName = firstName;
      if (lastName !== undefined) userData.lastName = lastName;
      if (email !== undefined) userData.email = email;
      if (password) userData.password = password;
      if (phoneNumber !== undefined) userData.phoneNumber = phoneNumber;
      if (isActive !== undefined) userData.isActive = isActive;

      const profileData = {};
      if (customerCode !== undefined) profileData.customerCode = customerCode;
      if (membershipType !== undefined) profileData.membershipType = membershipType;
      if (address !== undefined) profileData.address = address;
      if (loyaltyPoints !== undefined) profileData.loyaltyPoints = loyaltyPoints;

      const updated = await customerService.updateCustomer(req.params.userId, {
        userData,
        profileData
      });

      res.status(200).json({
        success: true,
        message: 'Customer updated successfully',
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
      const result = await customerService.deleteCustomer(req.params.userId);
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
      const profile = await customerService.getProfileByUserId(req.params.userId || req.user._id);
      if (!profile) {
        return res.status(404).json({
          success: false,
          message: 'Customer profile not found'
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
      const customers = await customerService.getAllCustomers();
      res.status(200).json({
        success: true,
        data: customers
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new CustomerController();
