import franchiseService from './franchise.service.js';

class FranchiseController {
  /**
   * Public: Submit a franchise enquiry form
   * POST /api/franchise or POST /api/franchise/enquiry
   */
  async submitEnquiry(req, res, next) {
    try {
      const meta = {
        ipAddress: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '',
        userAgent: req.headers['user-agent'] || ''
      };

      const enquiry = await franchiseService.createEnquiry(req.body, meta);

      res.status(201).json({
        success: true,
        message: 'Franchise enquiry submitted successfully! Our expansion team will review your application and contact you soon.',
        data: {
          enquiryCode: enquiry.enquiryCode,
          fullName: enquiry.fullName,
          email: enquiry.email,
          phone: enquiry.phone,
          location: enquiry.location,
          currentOccupation: enquiry.currentOccupation,
          addressWithCode: enquiry.addressWithCode,
          status: enquiry.status,
          createdAt: enquiry.createdAt
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Super Admin: List all franchise enquiries with filters & pagination
   * GET /api/franchise or GET /api/franchise/enquiries
   */
  async getAllEnquiries(req, res, next) {
    try {
      const result = await franchiseService.getAllEnquiries(req.query);

      res.status(200).json({
        success: true,
        count: result.enquiries.length,
        total: result.total,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        limit: result.limit,
        data: result.enquiries
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Super Admin: Get franchise enquiry KPIs & statistics
   * GET /api/franchise/stats or GET /api/franchise/enquiries/stats
   */
  async getStats(req, res, next) {
    try {
      const stats = await franchiseService.getStats();

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Super Admin: Get single franchise enquiry by ID
   * GET /api/franchise/:id or GET /api/franchise/enquiries/:id
   */
  async getEnquiryById(req, res, next) {
    try {
      const enquiry = await franchiseService.getEnquiryById(req.params.id);

      res.status(200).json({
        success: true,
        data: enquiry
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Super Admin: Update enquiry status and admin notes
   * PATCH /api/franchise/:id/status or PATCH /api/franchise/enquiries/:id/status
   */
  async updateStatus(req, res, next) {
    try {
      const { status, adminNotes } = req.body;
      const updated = await franchiseService.updateEnquiryStatus(
        req.params.id,
        { status, adminNotes },
        req.user
      );

      res.status(200).json({
        success: true,
        message: 'Franchise enquiry status updated successfully',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Super Admin: Delete franchise enquiry
   * DELETE /api/franchise/:id or DELETE /api/franchise/enquiries/:id
   */
  async deleteEnquiry(req, res, next) {
    try {
      const result = await franchiseService.deleteEnquiry(req.params.id);

      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new FranchiseController();
