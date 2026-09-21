import jwt from 'jsonwebtoken';
import User from '../modules/user/user.model.js';

export const protect = async (req, res, next) => {
  try {
    let token;

    // 1. Check HTTP-Only Cookie first
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    // 2. Fallback to Authorization Header (Bearer token)
    else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication token missing. Please log in.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user and populate profile
    const user = await User.findById(decoded.id).populate('profile');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists.'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact an administrator.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please log in again.'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please log in again.'
      });
    }
    next(error);
  }
};

export default { protect };
