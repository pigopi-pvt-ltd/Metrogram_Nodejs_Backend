import express from 'express';
import serviceController from './service.controller.js';
import { protect } from '../../middleware/auth.js';
import { authorize } from '../../middleware/roleCheck.js';
import { ROLES } from '../../constants/roles.js';

const router = express.Router();

// Public routes (accessible by everyone / landing page)
router.get('/', serviceController.getAll.bind(serviceController));
router.get('/categories', serviceController.getCategories.bind(serviceController));
router.get('/:id', serviceController.getById.bind(serviceController));

// Protected routes (Super Admin only can create, update, delete, toggle status)
router.post(
  '/',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  serviceController.create.bind(serviceController)
);

router.put(
  '/:id',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  serviceController.update.bind(serviceController)
);

router.patch(
  '/:id/status',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  serviceController.toggleStatus.bind(serviceController)
);

router.delete(
  '/:id',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  serviceController.delete.bind(serviceController)
);

export default router;
