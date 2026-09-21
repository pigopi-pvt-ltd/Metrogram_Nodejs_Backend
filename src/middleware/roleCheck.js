import { ROLE_CREATION_PERMISSIONS } from '../constants/roles.js';

/**
 * Middleware to restrict route access to specific roles
 * @param  {...string} allowedRoles
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Role '${req.user.role}' is not authorized to access this resource`
      });
    }

    next();
  };
};

/**
 * Middleware to verify if current user has permission to create target role
 * Hierarchy:
 * Super Admin -> Manager, Employee, Customer
 * Manager     -> Employee, Customer
 * Employee    -> Customer
 * Customer    -> None
 */
export const verifyCanCreateRole = (req, res, next) => {
  const requesterRole = req.user.role;
  const targetRole = req.body.role || req.params.targetRole;

  if (!targetRole) {
    return res.status(400).json({
      success: false,
      message: 'Target role must be specified'
    });
  }

  const allowedRolesToCreate = ROLE_CREATION_PERMISSIONS[requesterRole] || [];

  if (!allowedRolesToCreate.includes(targetRole.toUpperCase())) {
    return res.status(403).json({
      success: false,
      message: `Forbidden: Role '${requesterRole}' is not permitted to create a user with role '${targetRole}'. Allowed roles you can create: [${allowedRolesToCreate.join(', ')}]`
    });
  }

  next();
};

export default {
  authorize,
  verifyCanCreateRole
};
