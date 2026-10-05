import serviceService from './service.service.js';

class ServiceController {
  /**
   * Create a new diagnostic test (Super Admin only)
   */
  async create(req, res, next) {
    try {
      const {
        testName,
        description,
        testType,
        reportTime,
        sampleType,
        price,
        discountedPrice,
        parametersMeasured,
        requiresFasting,
        fastingDuration,
        preparationInstructions,
        faqs,
        faq,
        isActive
      } = req.body;

      if (!testName || !description || !testType || !reportTime || !sampleType || price === undefined || discountedPrice === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: testName, description, testType, reportTime, sampleType, price, and discountedPrice are required'
        });
      }

      const rawFaqs = faqs !== undefined ? faqs : (faq !== undefined ? faq : []);
      const formattedFaqs = Array.isArray(rawFaqs)
        ? rawFaqs
            .filter((item) => item && typeof item === 'object' && (item.question || item.answer))
            .map((item) => ({
              question: item.question ? String(item.question).trim() : '',
              answer: item.answer ? String(item.answer).trim() : ''
            }))
        : [];

      const service = await serviceService.createService(
        {
          testName,
          description,
          testType,
          reportTime,
          sampleType,
          price: Number(price),
          discountedPrice: Number(discountedPrice),
          parametersMeasured: Array.isArray(parametersMeasured) ? parametersMeasured : (parametersMeasured ? [parametersMeasured] : []),
          requiresFasting: Boolean(requiresFasting),
          fastingDuration,
          preparationInstructions,
          faqs: formattedFaqs,
          isActive: isActive !== undefined ? Boolean(isActive) : true
        },
        req.user._id
      );

      res.status(201).json({
        success: true,
        message: 'Diagnostic test service created successfully',
        data: service
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
   * Update an existing diagnostic test (Super Admin only)
   */
  async update(req, res, next) {
    try {
      const updateData = { ...req.body };

      if (updateData.faq !== undefined && updateData.faqs === undefined) {
        updateData.faqs = updateData.faq;
        delete updateData.faq;
      }

      if (updateData.faqs !== undefined && Array.isArray(updateData.faqs)) {
        updateData.faqs = updateData.faqs
          .filter((item) => item && typeof item === 'object' && (item.question || item.answer))
          .map((item) => ({
            question: item.question ? String(item.question).trim() : '',
            answer: item.answer ? String(item.answer).trim() : ''
          }));
      }

      const service = await serviceService.updateService(req.params.id, updateData);
      res.status(200).json({
        success: true,
        message: 'Diagnostic test service updated successfully',
        data: service
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
   * Delete a diagnostic test (Super Admin only)
   */
  async delete(req, res, next) {
    try {
      const result = await serviceService.deleteService(req.params.id);
      res.status(200).json(result);
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
   * Toggle test active status (Super Admin only)
   */
  async toggleStatus(req, res, next) {
    try {
      const { isActive } = req.body;
      const service = await serviceService.toggleStatus(req.params.id, isActive);
      res.status(200).json({
        success: true,
        message: `Diagnostic test is now ${service.isActive ? 'Active' : 'Inactive'}`,
        data: service
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
   * Get single service by ID (Public)
   */
  async getById(req, res, next) {
    try {
      const service = await serviceService.getServiceById(req.params.id);
      res.status(200).json({
        success: true,
        data: service
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
   * List all services (Public for landing page, query filtering supported)
   */
  async getAll(req, res, next) {
    try {
      const result = await serviceService.getAllServices(req.query);
      res.status(200).json({
        success: true,
        count: result.services.length,
        total: result.total,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        limit: result.limit,
        data: result.services
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get categories and sample types (Public)
   */
  async getCategories(req, res, next) {
    try {
      const data = await serviceService.getCategories();
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user's test bookings
   */
  async getMyBookings(req, res, next) {
    try {
      const result = await serviceService.getCustomerBookings(req.user._id, req.query);
      res.status(200).json({
        success: true,
        count: result.bookings.length,
        total: result.total,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        limit: result.limit,
        data: result.bookings
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List all test bookings (Staff / Admin)
   */
  async getAllBookings(req, res, next) {
    try {
      const result = await serviceService.getAllBookings(req.query);
      res.status(200).json({
        success: true,
        count: result.bookings.length,
        total: result.total,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        limit: result.limit,
        data: result.bookings
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single booking by ID
   */
  async getBookingById(req, res, next) {
    try {
      const booking = await serviceService.getBookingById(req.params.id, req.user);
      res.status(200).json({
        success: true,
        data: booking
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
   * Update booking status and details (Staff)
   */
  async updateBookingStatus(req, res, next) {
    try {
      const booking = await serviceService.updateBookingStatus(req.params.id, req.body, req.user._id);
      res.status(200).json({
        success: true,
        message: 'Booking status updated successfully',
        data: booking
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
}

export default new ServiceController();
