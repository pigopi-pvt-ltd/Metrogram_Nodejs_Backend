import express from 'express';
import serviceController from './service.controller.js';
import { protect } from '../../middleware/auth.js';
import { authorize } from '../../middleware/roleCheck.js';
import { ROLES } from '../../constants/roles.js';

const router = express.Router();

// Service Bookings (Customer & Staff routes)
router.get('/bookings/my-bookings', protect, serviceController.getMyBookings.bind(serviceController));
router.get(
  '/bookings',
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE),
  serviceController.getAllBookings.bind(serviceController)
);
router.get('/bookings/:id', protect, serviceController.getBookingById.bind(serviceController));
router.get('/bookings/:id/receipt', protect, (req, res, next) => {
  req.params.bookingIdentifier = req.params.id;
  import('../receipt/receipt.controller.js').then(m => m.default.downloadBookingReceiptPdf(req, res, next)).catch(next);
});
router.post('/bookings/:id/cancel', protect, serviceController.cancelBooking.bind(serviceController));
router.patch(
  '/bookings/:id/status',
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE),
  serviceController.updateBookingStatus.bind(serviceController)
);

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
