import express from 'express';
import cardController from './card.controller.js';
import { protect } from '../../middleware/auth.js';
import { authorize } from '../../middleware/roleCheck.js';
import { ROLES } from '../../constants/roles.js';

const router = express.Router();

// Public routes for viewing card plans (landing page & public catalog)
router.get('/plans', cardController.getAllPlans.bind(cardController));
router.get('/plans/:id', cardController.getPlanById.bind(cardController));

// Customer card purchase and my-card inspection (authenticated users)
router.post('/purchase', protect, cardController.purchaseCard.bind(cardController));
router.get('/my-card', protect, cardController.getMyCard.bind(cardController));
router.get('/my-card/receipt', protect, (req, res, next) => {
  import('../receipt/receipt.controller.js').then(m => m.default.downloadMyCardReceiptPdf(req, res, next)).catch(next);
});
// Explicit guard: Health cards cannot be cancelled or refunded
router.all(['/my-card/cancel', '/cancel'], protect, (req, res) => {
  return res.status(400).json({
    success: false,
    message: 'Health Card subscriptions are non-refundable and cannot be cancelled or refunded.'
  });
});

// Staff assigning card or inspecting customer card
router.post(
  '/assign',
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE),
  cardController.assignCard.bind(cardController)
);

router.get(
  '/customer/:userId',
  protect,
  authorize(ROLES.SUPER_ADMIN, ROLES.MANAGER, ROLES.EMPLOYEE),
  cardController.getCustomerCard.bind(cardController)
);

// Super Admin plan management (Create, Update, Delete, Toggle Status)
router.post(
  '/plans',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  cardController.createPlan.bind(cardController)
);

router.put(
  '/plans/:id',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  cardController.updatePlan.bind(cardController)
);

router.patch(
  '/plans/:id/status',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  cardController.togglePlanStatus.bind(cardController)
);

router.delete(
  '/plans/:id',
  protect,
  authorize(ROLES.SUPER_ADMIN),
  cardController.deletePlan.bind(cardController)
);

export default router;
