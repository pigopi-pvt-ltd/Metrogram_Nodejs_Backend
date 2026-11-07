import https from 'https';
import http from 'http';
import packageService from './package.service.js';

class PackageController {
  /**
   * Create a new package (Super Admin only, no category required)
   */
  async create(req, res, next) {
    try {
      const {
        packageName,
        testName,
        name,
        description,
        packageType,
        testType,
        reportTime,
        sampleType,
        hospitalName,
        price,
        discountedPrice,
        parametersMeasured,
        testsIncluded,
        tests,
        requiresFasting,
        fastingDuration,
        preparationInstructions,
        faqs,
        faq,
        isActive
      } = req.body;

      const finalName = packageName || testName || name;
      const finalType = packageType || testType || 'Comprehensive Health Package';

      if (!finalName || !description || !reportTime || !sampleType || price === undefined || discountedPrice === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: packageName (or testName), description, reportTime, sampleType, price, and discountedPrice are required'
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

      const pkg = await packageService.createPackage(
        {
          packageName: String(finalName).trim(),
          description: String(description).trim(),
          packageType: String(finalType).trim(),
          testType: String(finalType).trim(),
          reportTime: String(reportTime).trim(),
          sampleType: String(sampleType).trim(),
          hospitalName: hospitalName ? String(hospitalName).trim() : '',
          price: Number(price),
          discountedPrice: Number(discountedPrice),
          parametersMeasured: Array.isArray(parametersMeasured) ? parametersMeasured : (parametersMeasured ? [parametersMeasured] : []),
          testsIncluded: Array.isArray(testsIncluded) ? testsIncluded : (testsIncluded ? [testsIncluded] : []),
          tests: Array.isArray(tests) ? tests : (tests ? [tests] : []),
          requiresFasting: Boolean(requiresFasting),
          fastingDuration: fastingDuration ? String(fastingDuration).trim() : '',
          preparationInstructions: preparationInstructions ? String(preparationInstructions).trim() : '',
          faqs: formattedFaqs,
          isActive: isActive !== undefined ? Boolean(isActive) : true
        },
        req.user._id
      );

      res.status(201).json({
        success: true,
        message: 'Package created successfully',
        data: pkg
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
   * Update an existing package (Super Admin only)
   */
  async update(req, res, next) {
    try {
      const updateData = { ...req.body };

      if (updateData.testName && !updateData.packageName) {
        updateData.packageName = updateData.testName;
      }
      if (updateData.name && !updateData.packageName) {
        updateData.packageName = updateData.name;
      }

      if (updateData.testType && !updateData.packageType) {
        updateData.packageType = updateData.testType;
      }

      // Packages do not have categories - strip category if present
      delete updateData.category;
      delete updateData.categoryId;

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

      const pkg = await packageService.updatePackage(req.params.id, updateData);
      res.status(200).json({
        success: true,
        message: 'Package updated successfully',
        data: pkg
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
   * Delete a package (Super Admin only)
   */
  async delete(req, res, next) {
    try {
      const result = await packageService.deletePackage(req.params.id);
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
   * Toggle package active status (Super Admin only)
   */
  async toggleStatus(req, res, next) {
    try {
      const { isActive } = req.body;
      const pkg = await packageService.toggleStatus(req.params.id, isActive);
      res.status(200).json({
        success: true,
        message: `Package is now ${pkg.isActive ? 'Active' : 'Inactive'}`,
        data: pkg
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
   * Get single package by ID (Public)
   */
  async getById(req, res, next) {
    try {
      const pkg = await packageService.getPackageById(req.params.id);
      res.status(200).json({
        success: true,
        data: pkg
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
   * List all packages (Public for landing page & catalog, query filtering supported)
   */
  async getAll(req, res, next) {
    try {
      const result = await packageService.getAllPackages(req.query);
      res.status(200).json({
        success: true,
        count: result.packages.length,
        total: result.total,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        limit: result.limit,
        data: result.packages
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get distinct package types and sample types (Public)
   */
  async getPackageTypes(req, res, next) {
    try {
      const data = await packageService.getPackageTypes();
      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Alias for getPackageTypes to match test categories endpoint for seamless frontend consumption
   */
  async getCategories(req, res, next) {
    return this.getPackageTypes(req, res, next);
  }

  /**
   * Get current user's package bookings
   */
  async getMyBookings(req, res, next) {
    try {
      const result = await packageService.getCustomerBookings(req.user._id, req.query);
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
   * List all package bookings (Staff / Admin)
   */
  async getAllBookings(req, res, next) {
    try {
      const result = await packageService.getAllBookings(req.query);
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
   * Get single package booking by ID
   */
  async getBookingById(req, res, next) {
    try {
      const booking = await packageService.getBookingById(req.params.id, req.user);
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
   * Update package booking status and details (Staff)
   * Supports multipart/form-data for report PDF file upload or JSON body
   */
  async updateBookingStatus(req, res, next) {
    try {
      const file = req.file || (req.files && req.files.report ? req.files.report[0] : null);
      const booking = await packageService.updateBookingStatus(req.params.id, req.body, req.user._id, file);
      res.status(200).json({
        success: true,
        message: 'Package booking status updated successfully',
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
   * Cancel booking and trigger automated Cashfree refund
   */
  async cancelBooking(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const result = await packageService.cancelBooking(id, { reason }, req.user);

      res.status(200).json({
        success: true,
        message: result.message,
        data: result
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
   * Download / View package test result report
   */
  async downloadReport(req, res, next) {
    try {
      const { id } = req.params;
      const { token } = req.query;

      let booking;
      if (token) {
        const PackageBooking = (await import('./packageBooking.model.js')).default;
        booking = await PackageBooking.findOne({ _id: id, reportAccessToken: token });
        if (!booking) {
          return res.status(403).json({
            success: false,
            message: 'Invalid or expired report download link.'
          });
        }
      } else {
        if (!req.user) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required to access report.'
          });
        }
        booking = await packageService.getBookingById(id, req.user);
      }

      if (!booking || !booking.reportUrl) {
        return res.status(404).json({
          success: false,
          message: 'Package report is not ready or has not been uploaded yet.'
        });
      }

      const filename = `Package_Report_${booking.bookingCode}.pdf`;

      if (req.query.format === 'json') {
        return res.status(200).json({
          success: true,
          bookingCode: booking.bookingCode,
          reportUrl: booking.reportUrl,
          downloadUrl: `/api/packages/bookings/${booking._id}/report`,
          filename
        });
      }

      const client = booking.reportUrl.startsWith('https:') ? https : http;
      client
        .get(booking.reportUrl, (remoteRes) => {
          if (remoteRes.statusCode >= 400) {
            return res.status(remoteRes.statusCode).json({
              success: false,
              message: 'Failed to fetch report from cloud storage'
            });
          }

          const disposition = req.query.download === 'true' ? 'attachment' : 'inline';
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
          if (remoteRes.headers['content-length']) {
            res.setHeader('Content-Length', remoteRes.headers['content-length']);
          }

          remoteRes.pipe(res);
        })
        .on('error', (err) => {
          next(err);
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

export default new PackageController();
