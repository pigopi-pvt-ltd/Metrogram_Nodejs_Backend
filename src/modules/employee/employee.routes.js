import express from 'express';
import employeeController from './employee.controller.js';
import { protect } from '../../middleware/auth.js';
import { authorize } from '../../middleware/roleCheck.js';
import { ROLES } from '../../constants/roles.js';
import { uploadProfileImage } from '../../middleware/upload.js';

const router = express.Router();

router.use(protect);

// Super Admin and Manager can create Employees (supports profile image upload)
router.post(
  '/',
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER),
  uploadProfileImage,
  employeeController.create.bind(employeeController)
);

// Super Admin, Manager, and Employee can list all employees
router.get(
  '/',
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE),
  employeeController.getAll.bind(employeeController)
);

// Super Admin, Manager, and Employee can view employee profile
router.get(
  '/:userId',
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE),
  employeeController.getProfile.bind(employeeController)
);

// Super Admin and Manager can update Employee (supports profile image upload)
router.put(
  '/:userId',
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER),
  uploadProfileImage,
  employeeController.update.bind(employeeController)
);

// Dedicated profile image update for employee
router.patch(
  '/:userId/profile-image',
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE),
  uploadProfileImage,
  employeeController.updateProfileImage.bind(employeeController)
);

// Super Admin and Manager can delete Employee
router.delete(
  '/:userId',
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER),
  employeeController.delete.bind(employeeController)
);

export default router;
