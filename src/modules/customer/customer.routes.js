import express from 'express';
import customerController from './customer.controller.js';
import { protect } from '../../middleware/auth.js';
import { authorize } from '../../middleware/roleCheck.js';
import { ROLES } from '../../constants/roles.js';
import { uploadCustomerDocuments } from '../../middleware/upload.js';

const router = express.Router();

router.use(protect);

// Super Admin, Manager, and Employee can create Customers (supports multipart/form-data for document uploads)
router.post(
  '/',
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE),
  uploadCustomerDocuments,
  customerController.create.bind(customerController)
);

// Super Admin, Manager, and Employee can list all customers
router.get(
  '/',
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE),
  customerController.getAll.bind(customerController)
);

// All authenticated roles can view customer profile
router.get(
  '/:userId',
  customerController.getProfile.bind(customerController)
);

// Super Admin, Manager, and Employee can view all bookings made by a specific customer
router.get(
  '/:userId/bookings',
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE),
  customerController.getCustomerBookings.bind(customerController)
);

// All authenticated roles (SUPER_ADMIN, MANAGER, EMPLOYEE, or the CUSTOMER themselves) can update
router.put(
  '/:userId',
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE, ROLES.CUSTOMER),
  uploadCustomerDocuments,
  customerController.update.bind(customerController)
);

// Super Admin, Manager, and Employee can delete Customers
router.delete(
  '/:userId',
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE),
  customerController.delete.bind(customerController)
);

export default router;
