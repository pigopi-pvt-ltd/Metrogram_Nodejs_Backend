import crypto from 'crypto';
import mongoose from 'mongoose';
import Package from './package.model.js';
import PackageBooking from './packageBooking.model.js';
import { ROLES } from '../../constants/roles.js';
import emailService from '../../services/email.service.js';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../../config/cloudinary.js';

class PackageService {
  /**
   * Create a new package (Super Admin only, no category required)
   */
  async createPackage(packageData, creatorId) {
    const pkg = new Package({
      ...packageData,
      createdBy: creatorId
    });

    return await pkg.save();
  }

  /**
   * Update an existing package
   */
  async updatePackage(packageId, updateData) {
    const pkg = await Package.findById(packageId);
    if (!pkg) {
      const err = new Error('Package not found');
      err.statusCode = 404;
      throw err;
    }

    // Explicitly delete category if passed in updateData
    delete updateData.category;
    delete updateData.categoryId;

    Object.assign(pkg, updateData);
    await pkg.save();

    return pkg;
  }

  /**
   * Delete a package
   */
  async deletePackage(packageId) {
    const pkg = await Package.findById(packageId);
    if (!pkg) {
      const err = new Error('Package not found');
      err.statusCode = 404;
      throw err;
    }

    await Package.findByIdAndDelete(packageId);
    return { success: true, message: 'Package deleted successfully' };
  }

  /**
   * Toggle package active status
   */
  async toggleStatus(packageId, isActive) {
    const pkg = await Package.findById(packageId);
    if (!pkg) {
      const err = new Error('Package not found');
      err.statusCode = 404;
      throw err;
    }

    pkg.isActive = isActive !== undefined ? isActive : !pkg.isActive;
    await pkg.save();

    return pkg;
  }

  /**
   * Get single package by ID
   */
  async getPackageById(packageId) {
    const pkg = await Package.findById(packageId)
      .populate('createdBy', 'firstName lastName email role')
      .populate('tests', 'testName testType sampleType price discountedPrice');

    if (!pkg) {
      const err = new Error('Package not found');
      err.statusCode = 404;
      throw err;
    }
    return pkg;
  }

  /**
   * Query all packages with filtering, search, and pagination
   */
  async getAllPackages({
    packageType,
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

    const typeFilter = packageType || testType;
    if (typeFilter) {
      filter.$or = [
        { packageType: { $regex: new RegExp(`^${typeFilter}$`, 'i') } },
        { testType: { $regex: new RegExp(`^${typeFilter}$`, 'i') } }
      ];
    }

    if (sampleType) {
      filter.sampleType = { $regex: new RegExp(sampleType, 'i') };
    }

    if (requiresFasting !== undefined && requiresFasting !== '') {
      filter.requiresFasting = requiresFasting === 'true' || requiresFasting === true;
    }

    if (search) {
      filter.$or = [
        { packageName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { packageType: { $regex: search, $options: 'i' } },
        { testType: { $regex: search, $options: 'i' } },
        { sampleType: { $regex: search, $options: 'i' } },
        { parametersMeasured: { $elemMatch: { $regex: search, $options: 'i' } } },
        { testsIncluded: { $elemMatch: { $regex: search, $options: 'i' } } },
        { 'faqs.question': { $regex: search, $options: 'i' } },
        { 'faqs.answer': { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;
    const sortObj = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [packages, total] = await Promise.all([
      Package.find(filter)
        .populate('createdBy', 'firstName lastName email role')
        .populate('tests', 'testName testType sampleType price discountedPrice')
        .sort(sortObj)
        .skip(skip)
        .limit(limitNum),
      Package.countDocuments(filter)
    ]);

    return {
      packages,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      limit: limitNum
    };
  }

  /**
   * Get distinct package types and sample types for filters (returns empty categories for frontend compatibility)
   */
  async getPackageTypes() {
    const [packageTypes, sampleTypes] = await Promise.all([
      Package.distinct('packageType', { isActive: true }),
      Package.distinct('sampleType', { isActive: true })
    ]);
    return {
      categories: [],
      packageTypes,
      sampleTypes
    };
  }

  /**
   * Get all package bookings for a customer
   */
  async getCustomerBookings(userId, { page = 1, limit = 20, status } = {}) {
    const filter = { customer: userId };
    if (status) filter.bookingStatus = status;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [bookings, total] = await Promise.all([
      PackageBooking.find(filter)
        .populate('package')
        .populate('payment')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      PackageBooking.countDocuments(filter)
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
   * Get all package bookings (Staff / Super Admin / Manager)
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
      PackageBooking.find(filter)
        .populate('customer', 'firstName lastName email phoneNumber profileImage')
        .populate('package')
        .populate('payment')
        .populate('handledBy', 'firstName lastName email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      PackageBooking.countDocuments(filter)
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
   * Get single package booking by ID
   */
  async getBookingById(bookingId, requestingUser) {
    const booking = await PackageBooking.findById(bookingId)
      .populate('customer', 'firstName lastName email phoneNumber profileImage')
      .populate('package')
      .populate('payment')
      .populate('handledBy', 'firstName lastName email role');

    if (!booking) {
      const err = new Error('Package booking not found');
      err.statusCode = 404;
      throw err;
    }

    if (
      requestingUser &&
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
   * Update package booking status and details (Staff)
   * Supports file upload for test result report PDF
   */
  async updateBookingStatus(
    bookingId,
    { bookingStatus, sampleCollectedAt, reportReadyAt, reportUrl, notes, hospitalName },
    staffUserId,
    file = null
  ) {
    const booking = await PackageBooking.findById(bookingId)
      .populate('customer', 'firstName lastName email phoneNumber profileImage')
      .populate('package');

    if (!booking) {
      const err = new Error('Package booking not found');
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
    if (hospitalName !== undefined) booking.hospitalName = String(hospitalName).trim();
    booking.handledBy = staffUserId;

    // Handle Report PDF file upload (if uploaded via multipart form)
    let uploadedFileBuffer = null;
    let uploadedFilename = null;
    if (file && file.buffer) {
      uploadedFileBuffer = file.buffer;
      uploadedFilename = file.originalname || `Report_${booking.bookingCode}.pdf`;

      if (booking.reportPublicId) {
        deleteFromCloudinary(booking.reportPublicId, { resource_type: 'raw' }).catch((err) => {
          console.warn('[Cloudinary] Failed to delete old package report:', err.message);
        });
      }

      const uploadResult = await uploadBufferToCloudinary(file.buffer, {
        folder: 'metrogram/package_reports',
        public_id: `pkg_report_${booking.bookingCode}_${Date.now()}`,
        resource_type: 'raw'
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
      const packageName = booking.package?.packageName || 'Diagnostic Health Package';

      const hostUrl = process.env.BASE_URL || (process.env.PORT ? `http://localhost:${process.env.PORT}` : 'http://localhost:3000');
      const directPdfDownloadUrl = `${hostUrl}/api/packages/bookings/${booking._id}/report?token=${booking.reportAccessToken}`;

      if (recipientEmail) {
        emailService
          .sendTestReportEmail({
            to: recipientEmail,
            name: patientName,
            testName: packageName,
            bookingCode: booking.bookingCode,
            reportUrl: directPdfDownloadUrl,
            pdfBuffer: uploadedFileBuffer,
            filename: uploadedFilename
          })
          .catch((emailErr) => {
            console.error(`[PackageService] Failed to send report email for ${booking.bookingCode}:`, emailErr.message);
          });
      }
    }

    return await this.getBookingById(booking._id, { role: ROLES.SUPER_ADMIN });
  }

  /**
   * Cancel Package Booking with automated Cashfree Refund
   */
  async cancelBooking(bookingId, { reason = '' }, requestingUser) {
    const booking = await PackageBooking.findById(bookingId)
      .populate('customer', 'firstName lastName email phoneNumber profileImage')
      .populate('package')
      .populate('payment');

    if (!booking) {
      const err = new Error('Package booking not found');
      err.statusCode = 404;
      throw err;
    }

    if (
      requestingUser.role === ROLES.CUSTOMER &&
      booking.customer._id.toString() !== requestingUser._id.toString()
    ) {
      const err = new Error('You are not authorized to cancel this booking');
      err.statusCode = 403;
      throw err;
    }

    if (booking.bookingStatus === 'CANCELLED') {
      const err = new Error('This booking is already cancelled');
      err.statusCode = 400;
      throw err;
    }

    if (booking.bookingStatus === 'COMPLETED') {
      const err = new Error('Completed package bookings cannot be cancelled or refunded');
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

    if (booking.payment && booking.payment.status === 'PAID') {
      const paymentService = (await import('../payment/payment.service.js')).default;
      try {
        refundResult = await paymentService.refundPaymentOrder({
          orderId: booking.payment.orderId,
          refundAmount: booking.amountPaid,
          refundNote: reason || 'Customer requested package booking cancellation',
          requestingUser
        });
      } catch (refundError) {
        console.error('❌ Automatic refund failed during package booking cancellation:', refundError.message);
        const err = new Error(`Cancellation failed during refund processing: ${refundError.message}`);
        err.statusCode = refundError.statusCode || 500;
        throw err;
      }
    } else {
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
      message: 'Package booking cancelled and refund processed successfully',
      bookingCode: booking.bookingCode,
      bookingStatus: 'CANCELLED',
      refundDetails: refundResult
    };
  }
}

export default new PackageService();
