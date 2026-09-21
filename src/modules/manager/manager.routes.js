import express from 'express';
import managerController from './manager.controller.js';
import { protect } from '../../middleware/auth.js';
import { authorize } from '../../middleware/roleCheck.js';
import { ROLES } from '../../constants/roles.js';

const router = express.Router();

router.use(protect);

// Create a Manager (Super Admin only)
router.post(
  '/',
  authorize(ROLES.SUPER_ADMIN),
  managerController.create.bind(managerController)
);

// List all managers (Super Admin & Manager)
router.get(
  '/',
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER),
  managerController.getAll.bind(managerController)
);

// View specific manager profile (Super Admin & Manager)
router.get(
  '/:userId',
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER),
  managerController.getProfile.bind(managerController)
);

// Update Manager (Super Admin only)
router.put(
  '/:userId',
  authorize(ROLES.SUPER_ADMIN),
  managerController.update.bind(managerController)
);

// Delete Manager (Super Admin only)
router.delete(
  '/:userId',
  authorize(ROLES.SUPER_ADMIN),
  managerController.delete.bind(managerController)
);

export default router;
