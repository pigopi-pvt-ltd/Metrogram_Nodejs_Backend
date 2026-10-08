import authService from './auth.service.js';
import { uploadBufferToCloudinary } from '../../config/cloudinary.js';

const getCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
  };
};

class AuthController {
  async register(req, res, next) {
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
        address
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

      // Handle document uploads from multer memory buffer
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

      const { token, user } = await authService.registerCustomer({
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
          address: parsedAddress
        }
      });

      // Set HTTP-Only Cookie
      res.cookie('token', token, getCookieOptions());

      res.status(201).json({
        success: true,
        message: 'Registration successful',
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          profile: user.profile,
          createdAt: user.createdAt
        }
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

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const { token, user } = await authService.login({ email, password });

      // Set HTTP-Only Cookie
      res.cookie('token', token, getCookieOptions());

      res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
          profile: user.profile,
          createdAt: user.createdAt
        }
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

  async logout(req, res, next) {
    try {
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('token', '', {
        httpOnly: true,
        expires: new Date(0),
        sameSite: isProduction ? 'none' : 'lax',
        secure: isProduction
      });

      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  async getMe(req, res, next) {
    try {
      const user = await authService.getMe(req.user._id);
      res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;
      const result = await authService.changePassword(req.user._id, {
        currentPassword,
        newPassword,
        confirmPassword
      });

      res.status(200).json({
        success: true,
        message: result.message
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

  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      const result = await authService.forgotPassword(email);

      res.status(200).json({
        success: true,
        message: result.message
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

  async resetPassword(req, res, next) {
    try {
      const { email, otp, newPassword, confirmPassword } = req.body;
      const result = await authService.resetPassword({
        email,
        otp,
        newPassword,
        confirmPassword
      });

      res.status(200).json({
        success: true,
        message: result.message
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

export default new AuthController();
