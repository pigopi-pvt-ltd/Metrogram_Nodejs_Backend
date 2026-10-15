import express from 'express';
import franchiseController from './franchise.controller.js';
import { protect } from '../../middleware/auth.js';
import { authorize } from '../../middleware/roleCheck.js';
import { ROLES } from '../../constants/roles.js';

const router = express.Router();

// ==========================================
// 1. PUBLIC FRANCHISE ENQUIRY ROUTES
// ==========================================

// Submit franchise enquiry form (Public)
router.post('/enquiry', franchiseController.submitEnquiry.bind(franchiseController));
router.post('/', franchiseController.submitEnquiry.bind(franchiseController));

// ==========================================
// 2. SUPER ADMIN FRANCHISE MANAGEMENT ROUTES
// ==========================================

// Franchise enquiries statistics & overview (Place before parameterized :id route)
router.get(
  '/stats',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  franchiseController.getStats.bind(franchiseController)
);

router.get(
  '/enquiries/stats',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  franchiseController.getStats.bind(franchiseController)
);

// List all franchise enquiries with filters & pagination
router.get(
  '/enquiries',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  franchiseController.getAllEnquiries.bind(franchiseController)
);

router.get(
  '/',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  franchiseController.getAllEnquiries.bind(franchiseController)
);

// Get single franchise enquiry by ID
router.get(
  '/enquiries/:id',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  franchiseController.getEnquiryById.bind(franchiseController)
);

router.get(
  '/:id',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  franchiseController.getEnquiryById.bind(franchiseController)
);

// Update enquiry status & admin notes
router.patch(
  '/enquiries/:id/status',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  franchiseController.updateStatus.bind(franchiseController)
);

router.patch(
  '/:id/status',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  franchiseController.updateStatus.bind(franchiseController)
);

// Delete franchise enquiry
router.delete(
  '/enquiries/:id',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  franchiseController.deleteEnquiry.bind(franchiseController)
);

router.delete(
  '/:id',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  franchiseController.deleteEnquiry.bind(franchiseController)
);

export default router;
