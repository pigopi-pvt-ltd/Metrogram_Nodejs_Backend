import authService from './auth.service.js';

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
}

export default new AuthController();
