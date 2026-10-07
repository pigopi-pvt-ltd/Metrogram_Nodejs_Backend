import express from 'express';
import receiptController from './receipt.controller.js';
import { protect } from '../../middleware/auth.js';
import { authorize } from '../../middleware/roleCheck.js';
import { ROLES } from '../../constants/roles.js';

const router = express.Router();

/**
 * 1. Health Card Receipts
 */
// Customer downloads their own active card receipt PDF
router.get('/cards/my-card/pdf', protect, receiptController.downloadMyCardReceiptPdf.bind(receiptController));
router.get('/cards/my-card', protect, receiptController.getMyCardReceiptJson.bind(receiptController));

// Staff downloads a customer's card receipt PDF
router.get(
  '/cards/customer/:userId/pdf',
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE),
  receiptController.downloadCustomerCardReceiptPdf.bind(receiptController)
);

/**
 * 2. Service Booking Receipts
 */
// Customer or Staff downloads service booking receipt PDF (by bookingCode or _id)
router.get('/bookings/:bookingIdentifier/pdf', protect, receiptController.downloadBookingReceiptPdf.bind(receiptController));
router.get('/bookings/:bookingIdentifier', protect, receiptController.getBookingReceiptJson.bind(receiptController));

/**
 * 3. Payment Order Receipts
 */
// Customer or Staff downloads payment receipt PDF (by orderId or _id)
router.get('/payments/:paymentIdentifier/pdf', protect, receiptController.downloadPaymentReceiptPdf.bind(receiptController));
router.get('/payments/:paymentIdentifier', protect, receiptController.getPaymentReceiptJson.bind(receiptController));

export default router;
