import express from 'express';
import authController from './auth.controller.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();

router.post('/login', authController.login.bind(authController));
router.post('/logout', authController.logout.bind(authController));
router.get('/me', protect, authController.getMe.bind(authController));

export default router;
