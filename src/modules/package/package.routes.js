import express from 'express';
import packageController from './package.controller.js';
import { protect } from '../../middleware/auth.js';
import { authorize } from '../../middleware/roleCheck.js';
import { ROLES } from '../../constants/roles.js';
import { uploadTestReport } from '../../middleware/upload.js';

const router = express.Router();

// Package Bookings (Customer & Staff routes)
router.get('/bookings/my-bookings', protect, packageController.getMyBookings.bind(packageController));
router.get(
  '/bookings',
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE),
  packageController.getAllBookings.bind(packageController)
);
router.get('/bookings/:id', protect, packageController.getBookingById.bind(packageController));
router.get('/bookings/:id/receipt', protect, (req, res, next) => {
  req.params.bookingIdentifier = req.params.id;
  import('../receipt/receipt.controller.js')
    .then((m) => m.default.downloadBookingReceiptPdf(req, res, next))
    .catch(next);
});
router.get('/bookings/:id/report', (req, res, next) => {
  // If reportAccessToken is provided in query, bypass JWT protect
  if (req.query.token) {
    return packageController.downloadReport(req, res, next);
  }
  return protect(req, res, () => packageController.downloadReport(req, res, next));
});
router.post('/bookings/:id/cancel', protect, packageController.cancelBooking.bind(packageController));
router.patch(
  '/bookings/:id/status',
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE),
  uploadTestReport,
  packageController.updateBookingStatus.bind(packageController)
);

// Public routes (accessible by everyone / landing page)
router.get('/', packageController.getAll.bind(packageController));
router.get('/types', packageController.getPackageTypes.bind(packageController));
router.get('/categories', packageController.getCategories.bind(packageController));
router.get('/:id', packageController.getById.bind(packageController));

// Protected routes (Super Admin only can create, update, delete, toggle status)
router.post(
  '/',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  packageController.create.bind(packageController)
);

router.put(
  '/:id',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  packageController.update.bind(packageController)
);

router.patch(
  '/:id/status',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  packageController.toggleStatus.bind(packageController)
);

router.delete(
  '/:id',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  packageController.delete.bind(packageController)
);

export default router;
