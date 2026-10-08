import express from 'express';
import authController from './auth.controller.js';
import { protect } from '../../middleware/auth.js';
import { uploadCustomerDocuments } from '../../middleware/upload.js';

const router = express.Router();

// Public Authentication & Customer Self-Registration
router.post('/register', uploadCustomerDocuments, authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));
router.post('/logout', authController.logout.bind(authController));
router.get('/me', protect, authController.getMe.bind(authController));

// Password Management Endpoints
router.post('/change-password', protect, authController.changePassword.bind(authController));
router.post('/forgot-password', authController.forgotPassword.bind(authController));
router.post('/reset-password', authController.resetPassword.bind(authController));

export default router;
