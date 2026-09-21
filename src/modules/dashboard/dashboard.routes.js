import express from 'express';
import dashboardController from './dashboard.controller.js';
import { protect } from '../../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/stats', dashboardController.getStats.bind(dashboardController));

export default router;
