import crypto from 'crypto';
import Service from './service.model.js';
import ServiceBooking from './serviceBooking.model.js';
import { ROLES } from '../../constants/roles.js';
import emailService from '../../services/email.service.js';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../../config/cloudinary.js';

class ServiceService {
  /**
   * Create a new diagnostic / lab test service
   */
  async createService(serviceData, creatorId) {
    const service = new Service({
      ...serviceData,
      createdBy: creatorId
    });

    return await service.save();
  }

  /**
   * Update an existing service
   */
  async updateService(serviceId, updateData) {
    const service = await Service.findById(serviceId);
    if (!service) {
      const err = new Error('Diagnostic test service not found');
      err.statusCode = 404;
      throw err;
    }

    Object.assign(service, updateData);
    await service.save();

    return service;
  }

  /**
   * Delete a service
   */
  async deleteService(serviceId) {
    const service = await Service.findById(serviceId);
    if (!service) {
      const err = new Error('Diagnostic test service not found');
      err.statusCode = 404;
      throw err;
    }

    await Service.findByIdAndDelete(serviceId);
    return { success: true, message: 'Diagnostic test service deleted successfully' };
  }

  /**
   * Toggle service active status
   */
  async toggleStatus(serviceId, isActive) {
    const service = await Service.findById(serviceId);
    if (!service) {
      const err = new Error('Diagnostic test service not found');
      err.statusCode = 404;
      throw err;
    }

    service.isActive = isActive !== undefined ? isActive : !service.isActive;
    await service.save();

    return service;
  }

  /**
   * Get single service by ID
   */
  async getServiceById(serviceId) {
    const service = await Service.findById(serviceId).populate(
      'createdBy',
      'firstName lastName email role'
    );
    if (!service) {
      const err = new Error('Diagnostic test service not found');
      err.statusCode = 404;
      throw err;
    }
    return service;
  }

  /**
   * Query all services with filtering, search, and pagination
   */
  async getAllServices({
    testType,
    search,
    requiresFasting,
    isActive,
    sampleType,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = {}) {
    const filter = {};

    if (isActive !== undefined && isActive !== '') {
      filter.isActive = isActive === 'true' || isActive === true;
    }

    if (testType) {
      filter.testType = { $regex: new RegExp(`^${testType}$`, 'i') };
    }

    if (sampleType) {
      filter.sampleType = { $regex: new RegExp(sampleType, 'i') };
    }

    if (requiresFasting !== undefined && requiresFasting !== '') {
      filter.requiresFasting = requiresFasting === 'true' || requiresFasting === true;
    }

    if (search) {
      filter.$or = [
        { testName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { testType: { $regex: search, $options: 'i' } },
        { sampleType: { $regex: search, $options: 'i' } },
        { parametersMeasured: { $elemMatch: { $regex: search, $options: 'i' } } },
        { 'faqs.question': { $regex: search, $options: 'i' } },
        { 'faqs.answer': { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;
    const sortObj = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [services, total] = await Promise.all([
      Service.find(filter)
        .populate('createdBy', 'firstName lastName email role')
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum),
      Service.countDocuments(filter)
    ]);

    return {
      services,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      limit: limitNum
    };
  }

  /**
   * Get distinct categories / test types for filters
   */
  async getCategories() {
    const categories = await Service.distinct('testType', { isActive: true });
    const sampleTypes = await Service.distinct('sampleType', { isActive: true });
    return {
      testTypes: categories,
      sampleTypes
    };
  }

  /**
   * Get all test bookings for a customer
   */
  async getCustomerBookings(userId, { page = 1, limit = 20, status } = {}) {
    const filter = { customer: userId };
    if (status) filter.bookingStatus = status;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [bookings, total] = await Promise.all([
      ServiceBooking.find(filter)
        .populate('service')
        .populate('payment')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      ServiceBooking.countDocuments(filter)
    ]);

    return {
      bookings,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      limit: limitNum
    };
  }

  /**
   * Get all test bookings (Staff / Super Admin / Manager)
   */
  async getAllBookings({ page = 1, limit = 20, status, customer, search } = {}) {
    const filter = {};
    if (status) filter.bookingStatus = status;

    if (customer) {
      filter.customer = customer;
    }

    if (search) {
      filter.$or = [
        { bookingCode: { $regex: search, $options: 'i' } },
        { 'patientDetails.name': { $regex: search, $options: 'i' } },
        { 'patientDetails.phone': { $regex: search, $options: 'i' } },
        { 'patientDetails.email': { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [bookings, total] = await Promise.all([
      ServiceBooking.find(filter)
        .populate('customer', 'firstName lastName email phoneNumber')
        .populate('service')
        .populate('payment')
        .populate('handledBy', 'firstName lastName email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      ServiceBooking.countDocuments(filter)
    ]);

    return {
      bookings,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      limit: limitNum
    };
  }

  /**
   * Get single booking by ID
   */
  async getBookingById(bookingId, requestingUser) {
    const booking = await ServiceBooking.findById(bookingId)
      .populate('customer', 'firstName lastName email phoneNumber')
      .populate('service')
      .populate('payment')
      .populate('handledBy', 'firstName lastName email role');

    if (!booking) {
      const err = new Error('Booking not found');
      err.statusCode = 404;
      throw err;
    }

    if (
      requestingUser.role === ROLES.CUSTOMER &&
      booking.customer._id.toString() !== requestingUser._id.toString()
    ) {
      const err = new Error('You are not authorized to view this booking');
      err.statusCode = 403;
      throw err;
    }

    return booking;
  }

  /**
   * Update booking status and details (Staff)
   * Supports file upload for test result report PDF
   */
  async updateBookingStatus(
    bookingId,
    { bookingStatus, sampleCollectedAt, reportReadyAt, reportUrl, notes },
    staffUserId,
    file = null
  ) {
    const booking = await ServiceBooking.findById(bookingId)
      .populate('customer', 'firstName lastName email phoneNumber')
      .populate('service');

    if (!booking) {
      const err = new Error('Booking not found');
      err.statusCode = 404;
      throw err;
    }

    if (bookingStatus) {
      booking.bookingStatus = bookingStatus;
      if (bookingStatus === 'SAMPLE_COLLECTED' && !booking.sampleCollectedAt) {
        booking.sampleCollectedAt = new Date();
      }
      if (bookingStatus === 'COMPLETED' && !booking.reportReadyAt) {
        booking.reportReadyAt = new Date();
      }
    }

    if (sampleCollectedAt) booking.sampleCollectedAt = new Date(sampleCollectedAt);
    if (reportReadyAt) booking.reportReadyAt = new Date(reportReadyAt);
    if (notes !== undefined) booking.notes = notes;
    booking.handledBy = staffUserId;

    // Handle Report PDF file upload (if uploaded via multipart form)
    let uploadedFileBuffer = null;
    let uploadedFilename = null;
    if (file && file.buffer) {
      uploadedFileBuffer = file.buffer;
      uploadedFilename = file.originalname || `Report_${booking.bookingCode}.pdf`;

      // If previous report exists in Cloudinary, clean it up
      if (booking.reportPublicId) {
        deleteFromCloudinary(booking.reportPublicId, { resource_type: 'raw' }).catch((err) => {
          console.warn('[Cloudinary] Failed to delete old test report:', err.message);
        });
      }

      const uploadResult = await uploadBufferToCloudinary(file.buffer, {
        folder: 'metrogram/reports',
        public_id: `report_${booking.bookingCode}_${Date.now()}`,
        resource_type: 'raw' // Preserves PDF extension and formatting
      });

      booking.reportUrl = uploadResult.secure_url;
      booking.reportPublicId = uploadResult.public_id;
      if (!booking.reportReadyAt) {
        booking.reportReadyAt = new Date();
      }
    } else if (reportUrl !== undefined) {
      booking.reportUrl = reportUrl;
    }

    if (!booking.reportAccessToken) {
      booking.reportAccessToken = crypto.randomBytes(24).toString('hex');
    }

    await booking.save();

    // If status is COMPLETED and reportUrl exists, send report email to customer
    if (booking.bookingStatus === 'COMPLETED' && booking.reportUrl) {
      const recipientEmail = booking.customer?.email || booking.patientDetails?.email;
      const patientName = booking.patientDetails?.name || booking.customer?.firstName || 'Customer';
      const testName = booking.service?.testName || 'Diagnostic Lab Test';

      // Build verified direct PDF download URL using backend proxy
      const hostUrl = process.env.BASE_URL || (process.env.PORT ? `http://localhost:${process.env.PORT}` : 'http://localhost:3000');
      const directPdfDownloadUrl = `${hostUrl}/api/services/bookings/${booking._id}/report?token=${booking.reportAccessToken}`;

      if (recipientEmail) {
        emailService
          .sendTestReportEmail({
            to: recipientEmail,
            name: patientName,
            testName,
            bookingCode: booking.bookingCode,
            reportUrl: directPdfDownloadUrl,
            pdfBuffer: uploadedFileBuffer,
            filename: uploadedFilename
          })
          .catch((emailErr) => {
            console.error(`[ServiceService] Failed to send report email for ${booking.bookingCode}:`, emailErr.message);
          });
      }
    }

    return await this.getBookingById(booking._id, { role: ROLES.SUPER_ADMIN });
  }

  /**
   * Customer or Staff cancels a Diagnostic Service Booking with automated Cashfree Refund
   */
  async cancelBooking(bookingId, { reason = '' }, requestingUser) {
    const booking = await ServiceBooking.findById(bookingId)
      .populate('customer', 'firstName lastName email phoneNumber')
      .populate('service')
      .populate('payment');

    if (!booking) {
      const err = new Error('Booking not found');
      err.statusCode = 404;
      throw err;
    }

    // Check authorization: Customer can only cancel their own booking
    if (
      requestingUser.role === ROLES.CUSTOMER &&
      booking.customer._id.toString() !== requestingUser._id.toString()
    ) {
      const err = new Error('You are not authorized to cancel this booking');
      err.statusCode = 403;
      throw err;
    }

    // Booking cannot be cancelled if already cancelled or completed
    if (booking.bookingStatus === 'CANCELLED') {
      const err = new Error('This booking is already cancelled');
      err.statusCode = 400;
      throw err;
    }

    if (booking.bookingStatus === 'COMPLETED') {
      const err = new Error('Completed test bookings cannot be cancelled or refunded');
      err.statusCode = 400;
      throw err;
    }

    if (booking.bookingStatus === 'SAMPLE_COLLECTED' || booking.bookingStatus === 'PROCESSING') {
      const err = new Error(
        'Sample has already been collected or is processing. The booking can no longer be cancelled.'
      );
      err.statusCode = 400;
      throw err;
    }

    let refundResult = null;

    // If payment was made and is PAID, trigger Cashfree refund
    if (booking.payment && booking.payment.status === 'PAID') {
      const paymentService = (await import('../payment/payment.service.js')).default;
      try {
        refundResult = await paymentService.refundPaymentOrder({
          orderId: booking.payment.orderId,
          refundAmount: booking.amountPaid,
          refundNote: reason || 'Customer requested diagnostic booking cancellation',
          requestingUser
        });
      } catch (refundError) {
        console.error('❌ Automatic refund failed during booking cancellation:', refundError.message);
        const err = new Error(`Cancellation failed during refund processing: ${refundError.message}`);
        err.statusCode = refundError.statusCode || 500;
        throw err;
      }
    } else {
      // If booking was unpaid or not processed via online gateway
      booking.bookingStatus = 'CANCELLED';
      booking.paymentStatus = 'REFUNDED';
      booking.cancelledAt = new Date();
      booking.cancelledBy = requestingUser._id;
      booking.cancellationReason = reason || 'Booking cancelled by user';
      booking.refundStatus = 'NOT_APPLICABLE';
      await booking.save();
    }

    return {
      success: true,
      message: 'Booking cancelled and refund processed successfully',
      bookingCode: booking.bookingCode,
      bookingStatus: 'CANCELLED',
      refundDetails: refundResult
    };
  }
}

export default new ServiceService();
