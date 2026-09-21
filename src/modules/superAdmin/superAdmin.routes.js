import express from 'express';
import superAdminController from './superAdmin.controller.js';
import { protect } from '../../middleware/auth.js';
import { authorize } from '../../middleware/roleCheck.js';
import { ROLES } from '../../constants/roles.js';

const router = express.Router();

router.use(protect);
router.use(authorize(ROLES.SUPER_ADMIN));

router.get('/profile', superAdminController.getProfile.bind(superAdminController));

export default router;
