import express from 'express';
import customerController from './customer.controller.js';
import { protect } from '../../middleware/auth.js';
import { authorize } from '../../middleware/roleCheck.js';
import { ROLES } from '../../constants/roles.js';

const router = express.Router();

router.use(protect);

// Super Admin, Manager, and Employee can create Customers
router.post(
  '/',
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE),
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

// Super Admin, Manager, and Employee can update Customers
router.put(
  '/:userId',
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE),
  customerController.update.bind(customerController)
);

// Super Admin, Manager, and Employee can delete Customers
router.delete(
  '/:userId',
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE),
  customerController.delete.bind(customerController)
);

export default router;
