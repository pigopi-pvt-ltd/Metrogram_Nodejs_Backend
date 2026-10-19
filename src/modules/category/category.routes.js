import express from 'express';
import categoryController from './category.controller.js';
import { protect } from '../../middleware/auth.js';
import { authorize } from '../../middleware/roleCheck.js';
import { ROLES } from '../../constants/roles.js';

const router = express.Router();

// Public routes (accessible by everyone / landing page / test dropdowns)
router.get('/', categoryController.getAll.bind(categoryController));
router.get('/:id', categoryController.getById.bind(categoryController));

// Protected routes (Super Admin only can create, update, delete, toggle status)
router.post(
  '/',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  categoryController.create.bind(categoryController)
);

router.put(
  '/:id',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  categoryController.update.bind(categoryController)
);

router.patch(
  '/:id/status',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  categoryController.toggleStatus.bind(categoryController)
);

router.delete(
  '/:id',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  categoryController.delete.bind(categoryController)
);

export default router;
