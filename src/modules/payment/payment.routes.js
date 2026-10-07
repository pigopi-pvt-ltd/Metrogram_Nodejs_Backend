import express from 'express';
import paymentController from './payment.controller.js';
import { protect } from '../../middleware/auth.js';
import { authorize } from '../../middleware/roleCheck.js';
import { ROLES } from '../../constants/roles.js';

const router = express.Router();

// 1. Cashfree Webhook endpoint (Public, signature-verified)
router.get('/webhook', (req, res) => res.status(200).json({ success: true, message: 'Cashfree webhook endpoint is active' }));
router.post('/webhook', paymentController.handleWebhook.bind(paymentController));

// 2. Public config for frontend checkout SDK
router.get('/config', paymentController.getConfig.bind(paymentController));

// 3. Customer payment flows (Authenticated)
router.post('/create-order', protect, paymentController.createOrder.bind(paymentController));
router.post('/verify/:orderId', protect, paymentController.verifyOrder.bind(paymentController));
router.get('/verify/:orderId', protect, paymentController.verifyOrder.bind(paymentController));
router.post('/discard/:orderId', protect, paymentController.discardOrder.bind(paymentController));
router.delete('/order/:orderId', protect, paymentController.discardOrder.bind(paymentController));
router.get('/order/:orderId', protect, paymentController.getPaymentByOrderId.bind(paymentController));
router.get('/order/:orderId/receipt', protect, (req, res, next) => {
  req.params.paymentIdentifier = req.params.orderId;
  import('../receipt/receipt.controller.js').then(m => m.default.downloadPaymentReceiptPdf(req, res, next)).catch(next);
});
router.get('/my-payments', protect, paymentController.getMyPayments.bind(paymentController));

// 4. Staff/Admin Management (Super Admin & Manager)
router.post(
  '/refund/:orderId',
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER),
  paymentController.refundOrder.bind(paymentController)
);
router.get(
  '/refunds/:orderId',
  protect,
  paymentController.getOrderRefunds.bind(paymentController)
);

router.get(
  '/',
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER),
  paymentController.getAllPayments.bind(paymentController)
);

export default router;
