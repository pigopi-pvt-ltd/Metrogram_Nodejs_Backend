import customerService from './customer.service.js';
import { uploadBufferToCloudinary } from '../../config/cloudinary.js';

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
        aadharNumber,
        panNumber,
        address,
        loyaltyPoints,
        assignedEmployee,
        employeeId
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

      // Check uploaded files from multer
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

      const newCustomer = await customerService.createCustomer({
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
          loyaltyPoints,
          assignedEmployee: assignedEmployee || employeeId
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

  async update(req, res, next) {
    try {
      let targetUserId = req.params.userId;

      // 1. If 'me' or omitted, resolve directly to logged-in user
      if (!targetUserId || targetUserId === 'me') {
        targetUserId = String(req.user._id);
      }

      // 2. If caller is a CUSTOMER, verify ownership (support matching against either User ID or Customer Profile ID)
      if (req.user.role === 'CUSTOMER') {
        const loggedInUserId = String(req.user._id);
        const loggedInProfileId = req.user.profile?._id
          ? String(req.user.profile._id)
          : (req.user.profile ? String(req.user.profile) : null);

        const isOwner = targetUserId === loggedInUserId || (loggedInProfileId && targetUserId === loggedInProfileId);

        if (!isOwner) {
          return res.status(403).json({
            success: false,
            message: "Forbidden: You are not authorized to update another customer's profile"
          });
        }

        // Always normalize targetUserId to the User's ObjectId for customerService.updateCustomer
        targetUserId = loggedInUserId;
      }

      const {
        firstName,
        lastName,
        email,
        password,
        phoneNumber,
        isActive,
        customerCode,
        membershipType,
        aadharNumber,
        panNumber,
        address,
        loyaltyPoints,
        assignedEmployee,
        employeeId
      } = req.body;

      const userData = {};
      if (firstName !== undefined) userData.firstName = firstName;
      if (lastName !== undefined) userData.lastName = lastName;
      if (email !== undefined) userData.email = email;
      if (password) userData.password = password;
      if (phoneNumber !== undefined) userData.phoneNumber = phoneNumber;
      if (isActive !== undefined && req.user.role !== 'CUSTOMER') {
        userData.isActive = isActive;
      }

      const profileData = {};
      if (customerCode !== undefined && req.user.role !== 'CUSTOMER') {
        profileData.customerCode = customerCode;
      }
      if (membershipType !== undefined && req.user.role !== 'CUSTOMER') {
        profileData.membershipType = membershipType;
      }
      if (aadharNumber !== undefined) profileData.aadharNumber = aadharNumber;
      if (panNumber !== undefined) profileData.panNumber = panNumber ? panNumber.toUpperCase() : null;

      if (assignedEmployee !== undefined) profileData.assignedEmployee = assignedEmployee;
      if (employeeId !== undefined) profileData.employeeId = employeeId;

      if (address !== undefined) {
        if (typeof address === 'string') {
          try {
            profileData.address = JSON.parse(address);
          } catch {
            profileData.address = { street: address };
          }
        } else {
          profileData.address = address;
        }
      }

      if (loyaltyPoints !== undefined) profileData.loyaltyPoints = loyaltyPoints;
      if (req.body.aadharImage !== undefined) profileData.aadharImage = req.body.aadharImage;
      if (req.body.panImage !== undefined) profileData.panImage = req.body.panImage;

      // Handle new uploaded files if provided
      if (req.files) {
        if (req.files.aadharImage && req.files.aadharImage[0]) {
          const file = req.files.aadharImage[0];
          const uploadRes = await uploadBufferToCloudinary(file.buffer, {
            folder: 'metrogram/customers/aadhar',
            public_id: `aadhar_${Date.now()}`
          });
          profileData.aadharImage = uploadRes.secure_url;
          profileData.aadharImagePublicId = uploadRes.public_id;
        }

        if (req.files.panImage && req.files.panImage[0]) {
          const file = req.files.panImage[0];
          const uploadRes = await uploadBufferToCloudinary(file.buffer, {
            folder: 'metrogram/customers/pan',
            public_id: `pan_${Date.now()}`
          });
          profileData.panImage = uploadRes.secure_url;
          profileData.panImagePublicId = uploadRes.public_id;
        }
      }

      const updated = await customerService.updateCustomer(
        targetUserId,
        {
          userData,
          profileData
        },
        req.user
      );

      res.status(200).json({
        success: true,
        message: 'Customer updated successfully',
        data: updated
      });
    } catch (error) {
      console.error('[CustomerController.update Error]', error);
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
      const result = await customerService.deleteCustomer(req.params.userId, req.user);
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
      const profile = await customerService.getProfileByUserId(targetUserId, req.user);
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
      const result = await customerService.getAllCustomers(req.query, req.user);
      res.status(200).json({
        success: true,
        count: result.customers.length,
        total: result.total,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        limit: result.limit,
        data: result.customers
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

  async getCustomerBookings(req, res, next) {
    try {
      const result = await customerService.getCustomerBookings(req.params.userId, req.query, req.user);
      res.status(200).json({
        success: true,
        customer: result.customer,
        count: result.bookings.length,
        total: result.total,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        limit: result.limit,
        data: result.bookings
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
   * Super Admin assigns or reassigns an employee to a customer
   */
  async assignEmployee(req, res, next) {
    try {
      const { employeeId } = req.body;
      const updated = await customerService.assignEmployee(
        req.params.userId,
        employeeId,
        req.user
      );

      res.status(200).json({
        success: true,
        message: employeeId && employeeId !== 'none'
          ? 'Employee assigned to customer successfully'
          : 'Employee unassigned from customer successfully',
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

export default new CustomerController();
