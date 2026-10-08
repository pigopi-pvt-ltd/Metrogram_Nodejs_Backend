import express from 'express';
import userController from './user.controller.js';
import { protect } from '../../middleware/auth.js';
import { authorize, verifyCanCreateRole } from '../../middleware/roleCheck.js';
import { ROLES } from '../../constants/roles.js';
import { uploadCustomerDocuments } from '../../middleware/upload.js';

const router = express.Router();

// Apply auth middleware to all user endpoints
router.use(protect);

// 1. Super Admin can add Manager
router.post(
  '/manager',
  authorize(ROLES.SUPER_ADMIN),
  userController.createManager.bind(userController)
);

// 2. Super Admin & Manager can add Employee
router.post(
  '/employee',
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER),
  userController.createEmployee.bind(userController)
);

// 3. Super Admin, Manager & Employee can add Customer (supports multipart/form-data for document uploads)
router.post(
  '/customer',
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE),
  uploadCustomerDocuments,
  userController.createCustomer.bind(userController)
);

// 4. Generic user creation (enforces hierarchy)
router.post(
  '/',
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE),
  verifyCanCreateRole,
  userController.createUser.bind(userController)
);

// 5. Query endpoints
router.get('/', userController.getAllUsers.bind(userController));
router.get('/:id', userController.getUserById.bind(userController));

// 6. Update user
router.put(
  '/:id',
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE),
  userController.updateUser.bind(userController)
);

// 7. Toggle status (Active / Inactive)
router.patch(
  '/:id/status',
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER),
  userController.toggleStatus.bind(userController)
);

// 8. Delete user
router.delete(
  '/:id',
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER),
  userController.deleteUser.bind(userController)
);

export default router;
