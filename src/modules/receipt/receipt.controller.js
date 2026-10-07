import receiptService from './receipt.service.js';

class ReceiptController {
  /**
   * Helper to send PDF download response
   */
  sendPdfResponse(res, buffer, filename) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  }

  /**
   * Download receipt by Payment Order ID or Payment ID (PDF)
   */
  async downloadPaymentReceiptPdf(req, res, next) {
    try {
      const { paymentIdentifier } = req.params;
      const receiptData = await receiptService.getReceiptDataByPayment(paymentIdentifier, req.user);
      const pdfBuffer = await receiptService.generateReceiptPdf(receiptData);

      const filename = `Receipt_${receiptData.receiptNumber || paymentIdentifier}.pdf`;
      return this.sendPdfResponse(res, pdfBuffer, filename);
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
   * Get receipt data JSON by Payment Order ID or Payment ID
   */
  async getPaymentReceiptJson(req, res, next) {
    try {
      const { paymentIdentifier } = req.params;
      const receiptData = await receiptService.getReceiptDataByPayment(paymentIdentifier, req.user);
      res.status(200).json({
        success: true,
        data: receiptData
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
   * Download receipt by Service Booking Code or ID (PDF)
   */
  async downloadBookingReceiptPdf(req, res, next) {
    try {
      const { bookingIdentifier } = req.params;
      const receiptData = await receiptService.getReceiptDataByBooking(bookingIdentifier, req.user);
      const pdfBuffer = await receiptService.generateReceiptPdf(receiptData);

      const filename = `Receipt_${receiptData.receiptNumber || bookingIdentifier}.pdf`;
      return this.sendPdfResponse(res, pdfBuffer, filename);
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
   * Get receipt data JSON by Booking Code or ID
   */
  async getBookingReceiptJson(req, res, next) {
    try {
      const { bookingIdentifier } = req.params;
      const receiptData = await receiptService.getReceiptDataByBooking(bookingIdentifier, req.user);
      res.status(200).json({
        success: true,
        data: receiptData
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
   * Download customer's active health card receipt (PDF)
   */
  async downloadMyCardReceiptPdf(req, res, next) {
    try {
      const receiptData = await receiptService.getReceiptDataByCard(req.user._id, req.user);
      const pdfBuffer = await receiptService.generateReceiptPdf(receiptData);

      const filename = `Receipt_${receiptData.receiptNumber || 'HealthCard'}.pdf`;
      return this.sendPdfResponse(res, pdfBuffer, filename);
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
   * Get customer's active health card receipt JSON
   */
  async getMyCardReceiptJson(req, res, next) {
    try {
      const receiptData = await receiptService.getReceiptDataByCard(req.user._id, req.user);
      res.status(200).json({
        success: true,
        data: receiptData
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
   * Staff/Admin download receipt for a specific customer's card (PDF)
   */
  async downloadCustomerCardReceiptPdf(req, res, next) {
    try {
      const { userId } = req.params;
      const receiptData = await receiptService.getReceiptDataByCard(userId, req.user);
      const pdfBuffer = await receiptService.generateReceiptPdf(receiptData);

      const filename = `Receipt_${receiptData.receiptNumber || userId}.pdf`;
      return this.sendPdfResponse(res, pdfBuffer, filename);
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
}

export default new ReceiptController();
