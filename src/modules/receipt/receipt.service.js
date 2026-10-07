import Payment from '../payment/payment.model.js';
import ServiceBooking from '../service/serviceBooking.model.js';
import Customer from '../customer/customer.model.js';
import receiptPdfService from './receipt.pdf.js';
import { COMPANY_INFO } from '../../constants/companyInfo.js';
import { ROLES } from '../../constants/roles.js';

class ReceiptService {
  /**
   * Helper to format full address string from object or string
   */
  formatAddress(addr) {
    if (!addr) return '';
    if (typeof addr === 'string') return addr;
    const parts = [addr.street, addr.city, addr.state, addr.zipCode, addr.country].filter(Boolean);
    return parts.join(', ');
  }

  /**
   * Fetch receipt data from a Payment record
   */
  async getReceiptDataByPayment(paymentIdOrOrderId, requestingUser) {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(paymentIdOrOrderId);
    const query = isObjectId ? { _id: paymentIdOrOrderId } : { orderId: paymentIdOrOrderId };

    const payment = await Payment.findOne(query)
      .populate('user', 'firstName lastName email phoneNumber')
      .populate('customer')
      .populate('entityId')
      .populate('serviceBooking');

    if (!payment) {
      const err = new Error(`Payment receipt not found for '${paymentIdOrOrderId}'`);
      err.statusCode = 404;
      throw err;
    }

    // Authorization check
    if (
      requestingUser &&
      requestingUser.role === ROLES.CUSTOMER &&
      payment.user._id.toString() !== requestingUser._id.toString()
    ) {
      const err = new Error('You are not authorized to view or download this receipt');
      err.statusCode = 403;
      throw err;
    }

    const userName = payment.user
      ? `${payment.user.firstName || ''} ${payment.user.lastName || ''}`.trim()
      : payment.customerDetails?.name || 'Valued Customer';
    const userEmail = payment.user?.email || payment.customerDetails?.email || '';
    const userPhone = payment.user?.phoneNumber || payment.customerDetails?.phone || '';

    let customerAddress = '';
    if (payment.customer?.address) {
      customerAddress = this.formatAddress(payment.customer.address);
    } else if (payment.bookingDetails?.address) {
      customerAddress = this.formatAddress(payment.bookingDetails.address);
    }

    let itemName = '';
    let itemDescription = '';
    let planType = '';
    let cardNumber = '';
    let validityInDays = null;
    let sampleType = '';
    let collectionType = 'LAB_VISIT';
    let scheduledDate = null;
    let timeSlot = '';
    let patientDetails = null;
    let collectionAddress = '';
    let originalPrice = payment.amount;

    if (payment.entityType === 'CARD') {
      itemName = payment.cardDetails?.planName || payment.entityId?.name || 'MetroGram Health Card';
      itemDescription = payment.entityId?.description || 'Exclusive discounts on diagnostic laboratory tests and health services';
      planType = payment.cardDetails?.planType || payment.entityId?.planType || '';
      cardNumber = payment.cardDetails?.cardNumber || '';
      validityInDays = payment.cardDetails?.validityInDays || payment.entityId?.validityInDays || null;
      originalPrice = payment.entityId?.price || payment.amount;
    } else if (payment.entityType === 'SERVICE') {
      const booking = payment.serviceBooking;
      const service = payment.entityId;

      itemName = service?.testName || payment.bookingDetails?.testName || 'Diagnostic Lab Test';
      itemDescription = service?.description || `Diagnostic medical investigation (${service?.testType || 'Pathology'})`;
      sampleType = service?.sampleType || payment.bookingDetails?.sampleType || '';
      collectionType = booking?.collectionType || payment.bookingDetails?.collectionType || 'LAB_VISIT';
      scheduledDate = booking?.scheduledDate || payment.bookingDetails?.scheduledDate || null;
      timeSlot = booking?.timeSlot || payment.bookingDetails?.timeSlot || '';
      originalPrice = booking?.originalPrice || service?.price || payment.amount;

      if (booking?.patientDetails) {
        patientDetails = {
          name: booking.patientDetails.name,
          age: booking.patientDetails.age,
          gender: booking.patientDetails.gender,
          phone: booking.patientDetails.phone,
          email: booking.patientDetails.email
        };
      } else if (payment.bookingDetails) {
        patientDetails = {
          name: payment.bookingDetails.patientName,
          age: payment.bookingDetails.patientAge,
          gender: payment.bookingDetails.patientGender,
          phone: payment.bookingDetails.patientPhone,
          email: payment.bookingDetails.patientEmail
        };
      }

      if (booking?.collectionAddress) {
        collectionAddress = this.formatAddress(booking.collectionAddress);
      } else if (payment.bookingDetails?.address) {
        collectionAddress = this.formatAddress(payment.bookingDetails.address);
      }
    }

    const receiptNumber = `REC-${payment.orderId.replace(/^ORD_/, '')}`;

    return {
      companyInfo: COMPANY_INFO,
      receiptNumber,
      receiptDate: payment.paymentTime || payment.createdAt,
      orderId: payment.orderId,
      cfPaymentId: payment.cfPaymentId,
      paymentMethod: payment.paymentGroup || payment.paymentMethod || 'Online Payment',
      paymentStatus: payment.status,
      customerName: userName,
      customerEmail: userEmail,
      customerPhone: userPhone,
      customerAddress,
      itemType: payment.entityType,
      itemName,
      itemDescription,
      amountPaid: payment.amount,
      originalPrice,
      planType,
      cardNumber,
      validityInDays,
      sampleType,
      collectionType,
      scheduledDate,
      timeSlot,
      patientDetails,
      collectionAddress
    };
  }

  /**
   * Fetch receipt data from a ServiceBooking record
   */
  async getReceiptDataByBooking(bookingIdOrCode, requestingUser) {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(bookingIdOrCode);
    const query = isObjectId ? { _id: bookingIdOrCode } : { bookingCode: bookingIdOrCode };

    const booking = await ServiceBooking.findOne(query)
      .populate('customer', 'firstName lastName email phoneNumber')
      .populate('service')
      .populate('payment');

    if (!booking) {
      const err = new Error(`Service booking receipt not found for '${bookingIdOrCode}'`);
      err.statusCode = 404;
      throw err;
    }

    // Authorization check
    if (
      requestingUser &&
      requestingUser.role === ROLES.CUSTOMER &&
      booking.customer._id.toString() !== requestingUser._id.toString()
    ) {
      const err = new Error('You are not authorized to view or download this receipt');
      err.statusCode = 403;
      throw err;
    }

    const userName = booking.customer
      ? `${booking.customer.firstName || ''} ${booking.customer.lastName || ''}`.trim()
      : booking.patientDetails?.name || 'Customer';
    const userEmail = booking.customer?.email || booking.patientDetails?.email || '';
    const userPhone = booking.customer?.phoneNumber || booking.patientDetails?.phone || '';

    const receiptNumber = `REC-${booking.bookingCode}`;

    return {
      companyInfo: COMPANY_INFO,
      receiptNumber,
      receiptDate: booking.createdAt,
      orderId: booking.payment?.orderId || booking.bookingCode,
      cfPaymentId: booking.payment?.cfPaymentId || null,
      paymentMethod: booking.payment?.paymentGroup || booking.payment?.paymentMethod || 'Online Payment',
      paymentStatus: booking.paymentStatus || 'PAID',
      customerName: userName,
      customerEmail: userEmail,
      customerPhone: userPhone,
      customerAddress: this.formatAddress(booking.collectionAddress),
      itemType: 'SERVICE',
      itemName: booking.service?.testName || 'Diagnostic Test',
      itemDescription: booking.service?.description || 'Diagnostic medical laboratory test',
      amountPaid: booking.amountPaid,
      originalPrice: booking.originalPrice || booking.amountPaid,
      sampleType: booking.service?.sampleType || '',
      collectionType: booking.collectionType || 'LAB_VISIT',
      scheduledDate: booking.scheduledDate,
      timeSlot: booking.timeSlot,
      patientDetails: booking.patientDetails,
      collectionAddress: this.formatAddress(booking.collectionAddress)
    };
  }

  /**
   * Fetch receipt data from active customer card or card history
   */
  async getReceiptDataByCard(userId, requestingUser, cardNumber = null) {
    // If requestingUser is customer, ensure they are fetching their own card
    const targetUserId = (requestingUser.role === ROLES.CUSTOMER) ? requestingUser._id : (userId || requestingUser._id);

    const customer = await Customer.findOne({ user: targetUserId })
      .populate('user', 'firstName lastName email phoneNumber')
      .populate('activeCard.cardPlan');

    if (!customer || !customer.hasCard || !customer.activeCard?.cardPlan) {
      const err = new Error('No active health card found for this customer');
      err.statusCode = 404;
      throw err;
    }

    // Try to find matching payment record for transaction metadata
    const payment = await Payment.findOne({
      user: targetUserId,
      entityType: 'CARD',
      status: 'PAID'
    }).sort({ createdAt: -1 });

    const card = customer.activeCard;
    const plan = card.cardPlan;
    const userName = customer.user
      ? `${customer.user.firstName || ''} ${customer.user.lastName || ''}`.trim()
      : 'Card Member';
    const userEmail = customer.user?.email || '';
    const userPhone = customer.user?.phoneNumber || '';

    const receiptNumber = payment?.orderId ? `REC-${payment.orderId.replace(/^ORD_/, '')}` : `REC-CARD-${card.cardNumber || Date.now()}`;

    return {
      companyInfo: COMPANY_INFO,
      receiptNumber,
      receiptDate: card.purchasedAt || payment?.paymentTime || new Date(),
      orderId: payment?.orderId || `CARD-${card.cardNumber}`,
      cfPaymentId: payment?.cfPaymentId || null,
      paymentMethod: payment?.paymentGroup || payment?.paymentMethod || 'Online Payment',
      paymentStatus: 'PAID',
      customerName: userName,
      customerEmail: userEmail,
      customerPhone: userPhone,
      customerAddress: this.formatAddress(customer.address),
      itemType: 'CARD',
      itemName: plan?.name || card.planName || 'MetroGram Health Card',
      itemDescription: plan?.description || 'Health Card Subscription with diagnostic test savings',
      amountPaid: card.price || plan?.price || 0,
      originalPrice: plan?.price || card.price || 0,
      planType: card.planType || plan?.planType || 'YEARLY',
      cardNumber: card.cardNumber,
      validityInDays: plan?.validityInDays || null
    };
  }

  /**
   * Generate PDF buffer for receipt
   */
  async generateReceiptPdf(receiptData) {
    return await receiptPdfService.generateReceiptBuffer(receiptData);
  }
}

export default new ReceiptService();
