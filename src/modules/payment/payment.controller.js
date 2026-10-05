import paymentService from './payment.service.js';

class PaymentController {
  /**
   * Get Cashfree environment configuration for frontend
   */
  async getConfig(req, res, next) {
    try {
      const config = paymentService.getConfig();
      res.status(200).json({
        success: true,
        data: config
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new Cashfree payment order (for Card or Service)
   */
  async createOrder(req, res, next) {
    try {
      const {
        entityType,
        entityId,
        bookingDetails,
        returnUrl,
        notes
      } = req.body;

      if (!entityType || !entityId) {
        return res.status(400).json({
          success: false,
          message: 'entityType (CARD or SERVICE) and entityId are required'
        });
      }

      const orderData = await paymentService.createPaymentOrder({
        userId: req.user._id,
        entityType: entityType.toUpperCase().trim(),
        entityId,
        bookingDetails,
        returnUrl,
        customNotes: notes
      });

      res.status(201).json({
        success: true,
        message: 'Payment order created successfully',
        data: orderData
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Verify Cashfree Payment Order and Fulfill Benefits
   */
  async verifyOrder(req, res, next) {
    try {
      const { orderId } = req.params;
      if (!orderId) {
        return res.status(400).json({
          success: false,
          message: 'orderId parameter is required'
        });
      }

      const payment = await paymentService.verifyAndFulfillPayment(orderId);

      res.status(200).json({
        success: true,
        message: payment.status === 'PAID' ? 'Payment verified and benefits activated successfully' : `Payment status: ${payment.status}`,
        data: payment
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Handle Cashfree Webhook Notifications
   */
  async handleWebhook(req, res, next) {
    try {
      const signature = req.headers['x-webhook-signature'];
      const timestamp = req.headers['x-webhook-timestamp'];
      const rawBody = req.rawBody || JSON.stringify(req.body);

      const result = await paymentService.handleWebhook(rawBody, signature, timestamp);

      res.status(200).json(result);
    } catch (error) {
      console.error('❌ Webhook error:', error.message);
      res.status(error.statusCode || 400).json({
        success: false,
        message: error.message || 'Webhook verification failed'
      });
    }
  }

  /**
   * Get single Payment by Order ID
   */
  async getPaymentByOrderId(req, res, next) {
    try {
      const { orderId } = req.params;
      const payment = await paymentService.getPaymentByOrderId(orderId, req.user);

      res.status(200).json({
        success: true,
        data: payment
      });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message
        });
      }
      next(error);
    }
  }

  /**
   * Get current logged-in customer's payment history
   */
  async getMyPayments(req, res, next) {
    try {
      const result = await paymentService.getCustomerPayments(req.user._id, req.query);

      res.status(200).json({
        success: true,
        count: result.payments.length,
        total: result.total,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        limit: result.limit,
        data: result.payments
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List all payments (Admin / Manager)
   */
  async getAllPayments(req, res, next) {
    try {
      const result = await paymentService.getAllPayments(req.query);

      res.status(200).json({
        success: true,
        count: result.payments.length,
        total: result.total,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        limit: result.limit,
        data: result.payments
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new PaymentController();
