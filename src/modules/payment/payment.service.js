import crypto from 'crypto';
import Payment from './payment.model.js';
import CardPlan from '../card/cardPlan.model.js';
import Service from '../service/service.model.js';
import ServiceBooking from '../service/serviceBooking.model.js';
import Customer from '../customer/customer.model.js';
import User from '../user/user.model.js';
import { getCashfreeClient, getCashfreeEnvironment } from '../../config/cashfree.js';
import { ROLES } from '../../constants/roles.js';

class PaymentService {
  /**
   * Get Cashfree SDK client
   */
  getClient() {
    return getCashfreeClient();
  }

  /**
   * Get public configuration for frontend checkout SDK
   */
  getConfig() {
    const env = (process.env.CASHFREE_ENV || 'SANDBOX').toUpperCase().trim();
    return {
      environment: env,
      isSandbox: env !== 'PRODUCTION',
      apiVersion: process.env.CASHFREE_API_VERSION || '2023-08-01'
    };
  }

  /**
   * Create a Cashfree Payment Order for a Card Plan or Diagnostic Service
   */
  async createPaymentOrder({
    userId,
    entityType,
    entityId,
    bookingDetails = {},
    returnUrl,
    customNotes = ''
  }) {
    if (!['CARD', 'SERVICE'].includes(entityType)) {
      const err = new Error("Invalid entityType. Must be 'CARD' or 'SERVICE'");
      err.statusCode = 400;
      throw err;
    }

    // 1. Fetch User and linked Customer Profile
    const user = await User.findById(userId);
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }

    let customerProfile = await Customer.findOne({ user: userId });
    if (!customerProfile && user.role === ROLES.CUSTOMER) {
      // Auto-initialize customer profile if missing
      customerProfile = new Customer({
        user: userId,
        customerCode: `CUST-${Date.now().toString().slice(-6)}`
      });
      await customerProfile.save();
    }

    let amount = 0;
    let originalPrice = 0;
    let isCardDiscountApplied = false;
    let entityModel = '';
    let cardDetails = null;
    let formattedBookingDetails = null;
    let orderNote = '';

    // 2. Validate Entity and Calculate Amount
    if (entityType === 'CARD') {
      entityModel = 'CardPlan';
      const plan = await CardPlan.findById(entityId);
      if (!plan) {
        const err = new Error('Health Card Plan not found');
        err.statusCode = 404;
        throw err;
      }
      if (!plan.isActive) {
        const err = new Error('This Health Card Plan is currently inactive');
        err.statusCode = 400;
        throw err;
      }

      amount = Number(plan.price);
      originalPrice = amount;
      cardDetails = {
        planName: plan.name,
        planType: plan.planType,
        validityInDays: plan.validityInDays,
        discountPercentage: plan.discountPercentage
      };
      orderNote = `Purchase of ${plan.name} (${plan.planType}) Health Card`;
    } else if (entityType === 'SERVICE') {
      entityModel = 'Service';
      const service = await Service.findById(entityId);
      if (!service) {
        const err = new Error('Diagnostic Service/Test not found');
        err.statusCode = 404;
        throw err;
      }
      if (!service.isActive) {
        const err = new Error('This Diagnostic Service is currently inactive');
        err.statusCode = 400;
        throw err;
      }

      originalPrice = Number(service.price);

      // Check if customer holds an active health card
      const hasActiveCard =
        customerProfile?.hasCard &&
        customerProfile?.activeCard &&
        customerProfile.activeCard.status === 'ACTIVE' &&
        (!customerProfile.activeCard.expiresAt || new Date() < new Date(customerProfile.activeCard.expiresAt));

      if (hasActiveCard) {
        amount = Number(service.discountedPrice);
        isCardDiscountApplied = true;
      } else {
        amount = Number(service.price);
        isCardDiscountApplied = false;
      }

      formattedBookingDetails = {
        testName: service.testName,
        sampleType: service.sampleType,
        reportTime: service.reportTime,
        patientName: bookingDetails.patientName || `${user.firstName} ${user.lastName}`.trim(),
        patientAge: bookingDetails.patientAge ? Number(bookingDetails.patientAge) : undefined,
        patientGender: bookingDetails.patientGender || undefined,
        patientPhone: bookingDetails.patientPhone || user.phoneNumber || '',
        patientEmail: bookingDetails.patientEmail || user.email || '',
        scheduledDate: bookingDetails.scheduledDate ? new Date(bookingDetails.scheduledDate) : null,
        timeSlot: bookingDetails.timeSlot || '',
        collectionType: bookingDetails.collectionType || 'LAB_VISIT',
        address: bookingDetails.address || {},
        notes: bookingDetails.notes || customNotes || ''
      };

      orderNote = `Diagnostic Test: ${service.testName}${isCardDiscountApplied ? ' (Card Member Discount)' : ''}`;
    }

    if (amount <= 0) {
      const err = new Error('Calculated order amount must be greater than zero');
      err.statusCode = 400;
      throw err;
    }

    // 3. Generate Unique Order ID (Cashfree limit: 45 characters, alphanumeric and _ -)
    const timestamp = Date.now().toString();
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const orderId = `ORD_${entityType.substring(0, 3)}_${timestamp.slice(-8)}_${randomSuffix}`.toUpperCase();

    // 4. Determine Return URL
    const clientReturnUrl =
      returnUrl ||
      process.env.CASHFREE_RETURN_URL ||
      `${process.env.CLIENT_URL || 'http://localhost:5173'}/payment/status?order_id={order_id}`;

    // 5. Call Cashfree PGCreateOrder
    const cf = this.getClient();
    const cfRequest = {
      order_id: orderId,
      order_amount: Number(amount.toFixed(2)),
      order_currency: 'INR',
      customer_details: {
        customer_id: user._id.toString(),
        customer_name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Customer',
        customer_email: user.email || 'customer@example.com',
        customer_phone: (user.phoneNumber && user.phoneNumber.replace(/[^0-9]/g, '').slice(-10)) || '9999999999'
      },
      order_meta: {
        return_url: clientReturnUrl,
        notify_url: process.env.CASHFREE_NOTIFY_URL || undefined
      },
      order_note: orderNote.substring(0, 200)
    };

    let cfResponse;
    try {
      const response = await cf.PGCreateOrder(cfRequest);
      cfResponse = response.data;
    } catch (cfError) {
      console.error('❌ Cashfree PGCreateOrder error:', cfError.response?.data || cfError.message);
      const errMsg =
        cfError.response?.data?.message ||
        cfError.response?.data?.error ||
        cfError.message ||
        'Failed to initiate payment session with Cashfree';
      const err = new Error(errMsg);
      err.statusCode = cfError.response?.status || 502;
      throw err;
    }

    // 6. Save Payment Order Record in MongoDB
    const payment = new Payment({
      orderId,
      cfOrderId: cfResponse.cf_order_id || null,
      entityType,
      entityId,
      entityModel,
      user: user._id,
      customer: customerProfile?._id || null,
      amount: Number(amount.toFixed(2)),
      currency: 'INR',
      status: 'PENDING',
      paymentSessionId: cfResponse.payment_session_id || null,
      customerDetails: {
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        email: user.email,
        phone: user.phoneNumber
      },
      cardDetails,
      bookingDetails: formattedBookingDetails
    });

    await payment.save();

    return {
      orderId: payment.orderId,
      paymentSessionId: payment.paymentSessionId,
      cfOrderId: payment.cfOrderId,
      amount: payment.amount,
      currency: payment.currency,
      entityType: payment.entityType,
      entityId: payment.entityId,
      isCardDiscountApplied,
      originalPrice,
      customerDetails: payment.customerDetails,
      cardDetails: payment.cardDetails,
      bookingDetails: payment.bookingDetails,
      status: payment.status
    };
  }

  /**
   * Internal fulfillment handler (Idempotent)
   * Activates Card Subscription or creates ServiceBooking upon successful payment
   */
  async fulfillOrder(paymentDoc, paymentAttempt = null) {
    if (paymentDoc.isFulfilled) {
      return paymentDoc;
    }

    if (paymentDoc.entityType === 'CARD') {
      const plan = await CardPlan.findById(paymentDoc.entityId);
      if (plan) {
        const customerProfile = await Customer.findOne({ user: paymentDoc.user });
        if (customerProfile) {
          const purchasedAt = new Date();
          const expiresAt = new Date(purchasedAt.getTime() + plan.validityInDays * 24 * 60 * 60 * 1000);
          const cardNumber = `MC-${plan.planType.substring(0, 3)}-${Date.now().toString().slice(-6)}`;

          customerProfile.hasCard = true;
          customerProfile.activeCard = {
            cardPlan: plan._id,
            planName: plan.name,
            planType: plan.planType,
            cardNumber,
            price: plan.price,
            purchasedAt,
            expiresAt,
            status: 'ACTIVE'
          };

          customerProfile.cardHistory.push({
            cardPlan: plan._id,
            planName: plan.name,
            planType: plan.planType,
            cardNumber,
            price: plan.price,
            purchasedAt,
            expiresAt,
            assignedBy: paymentDoc.user,
            paymentStatus: 'COMPLETED'
          });

          await customerProfile.save();

          paymentDoc.cardDetails = {
            planName: plan.name,
            planType: plan.planType,
            validityInDays: plan.validityInDays,
            discountPercentage: plan.discountPercentage,
            cardNumber
          };
        }
      }
    } else if (paymentDoc.entityType === 'SERVICE') {
      const service = await Service.findById(paymentDoc.entityId);
      if (service) {
        const timestamp = Date.now().toString(36).toUpperCase();
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
        const bookingCode = `BK-${timestamp}-${rand}`;

        const isDiscountApplied = paymentDoc.amount < service.price;
        const discountAmount = isDiscountApplied ? service.price - paymentDoc.amount : 0;

        const booking = new ServiceBooking({
          bookingCode,
          customer: paymentDoc.user,
          service: service._id,
          payment: paymentDoc._id,
          amountPaid: paymentDoc.amount,
          originalPrice: service.price,
          discountApplied: discountAmount,
          isCardDiscountApplied: isDiscountApplied,
          bookingStatus: 'CONFIRMED',
          paymentStatus: 'PAID',
          patientDetails: {
            name: paymentDoc.bookingDetails?.patientName || paymentDoc.customerDetails?.name || 'Customer',
            age: paymentDoc.bookingDetails?.patientAge,
            gender: paymentDoc.bookingDetails?.patientGender,
            phone: paymentDoc.bookingDetails?.patientPhone || paymentDoc.customerDetails?.phone,
            email: paymentDoc.bookingDetails?.patientEmail || paymentDoc.customerDetails?.email
          },
          collectionType: paymentDoc.bookingDetails?.collectionType || 'LAB_VISIT',
          collectionAddress: paymentDoc.bookingDetails?.address || {},
          scheduledDate: paymentDoc.bookingDetails?.scheduledDate || null,
          timeSlot: paymentDoc.bookingDetails?.timeSlot || '',
          notes: paymentDoc.bookingDetails?.notes || ''
        });

        await booking.save();
        paymentDoc.serviceBooking = booking._id;
      }
    }

    if (paymentAttempt) {
      paymentDoc.cfPaymentId = paymentAttempt.cf_payment_id ? String(paymentAttempt.cf_payment_id) : paymentDoc.cfPaymentId;
      paymentDoc.paymentMethod = paymentAttempt.payment_method ? JSON.stringify(paymentAttempt.payment_method) : paymentDoc.paymentMethod;
      paymentDoc.paymentGroup = paymentAttempt.payment_group || paymentDoc.paymentGroup;
      paymentDoc.paymentTime = paymentAttempt.payment_completion_time ? new Date(paymentAttempt.payment_completion_time) : new Date();
    }

    paymentDoc.status = 'PAID';
    paymentDoc.isFulfilled = true;
    paymentDoc.fulfilledAt = new Date();

    await paymentDoc.save();
    return paymentDoc;
  }

  /**
   * Verify Cashfree Payment Order and fulfill benefits
   */
  async verifyAndFulfillPayment(orderId) {
    const payment = await Payment.findOne({ orderId })
      .populate('user', 'firstName lastName email phoneNumber')
      .populate('entityId')
      .populate('serviceBooking');

    if (!payment) {
      const err = new Error(`Payment order with ID '${orderId}' not found`);
      err.statusCode = 404;
      throw err;
    }

    // If already fulfilled, return current state
    if (payment.isFulfilled && payment.status === 'PAID') {
      return payment;
    }

    const cf = this.getClient();

    let cfOrder;
    let cfPayments = [];

    try {
      const [orderRes, paymentsRes] = await Promise.all([
        cf.PGFetchOrder(orderId),
        cf.PGOrderFetchPayments(orderId)
      ]);
      cfOrder = orderRes.data;
      cfPayments = Array.isArray(paymentsRes.data) ? paymentsRes.data : [];
    } catch (cfError) {
      console.error('❌ Cashfree verify error:', cfError.response?.data || cfError.message);
      const errMsg =
        cfError.response?.data?.message ||
        cfError.response?.data?.error ||
        cfError.message ||
        'Failed to fetch order status from Cashfree';
      const err = new Error(errMsg);
      err.statusCode = cfError.response?.status || 502;
      throw err;
    }

    const successfulPayment = cfPayments.find((p) => p.payment_status === 'SUCCESS');

    if (cfOrder.order_status === 'PAID' || successfulPayment) {
      await this.fulfillOrder(payment, successfulPayment);
    } else if (['EXPIRED', 'TERMINATED', 'CANCELLED'].includes(cfOrder.order_status)) {
      payment.status = 'CANCELLED';
      await payment.save();
    } else {
      const failedPayment = cfPayments.find((p) => ['FAILED', 'USER_DROPPED', 'CANCELLED'].includes(p.payment_status));
      if (failedPayment) {
        payment.status = failedPayment.payment_status;
        payment.cfPaymentId = failedPayment.cf_payment_id ? String(failedPayment.cf_payment_id) : payment.cfPaymentId;
        await payment.save();
      }
    }

    // Return freshly populated payment document
    return await Payment.findById(payment._id)
      .populate('user', 'firstName lastName email phoneNumber')
      .populate('entityId')
      .populate('serviceBooking');
  }

  /**
   * Handle Cashfree Webhook Events
   */
  async handleWebhook(rawBody, signature, timestamp) {
    if (!signature || !timestamp || !rawBody) {
      const err = new Error('Missing required webhook headers (x-webhook-signature, x-webhook-timestamp) or body');
      err.statusCode = 400;
      throw err;
    }

    // 1. Verify Signature
    const cf = this.getClient();
    let isSignatureValid = false;

    try {
      cf.PGVerifyWebhookSignature(signature, rawBody, timestamp);
      isSignatureValid = true;
    } catch (err) {
      // Fallback verification via direct crypto HMAC
      const secret = process.env.CASHFREE_SECRET;
      if (secret) {
        const expected = crypto
          .createHmac('sha256', secret)
          .update(timestamp + rawBody)
          .digest('base64');
        if (expected === signature) {
          isSignatureValid = true;
        }
      }
    }

    if (!isSignatureValid) {
      const err = new Error('Invalid Cashfree webhook signature');
      err.statusCode = 400;
      throw err;
    }

    // 2. Parse Event
    let eventPayload;
    try {
      eventPayload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    } catch (e) {
      const err = new Error('Malformed webhook JSON payload');
      err.statusCode = 400;
      throw err;
    }

    const { type, data } = eventPayload;
    const orderId = data?.order?.order_id;

    if (!orderId) {
      return { success: true, message: 'Webhook received (no order_id present, ignored)' };
    }

    const payment = await Payment.findOne({ orderId });
    if (!payment) {
      console.warn(`⚠️ Cashfree Webhook: Payment record '${orderId}' not found in database.`);
      return { success: true, message: 'Payment record not found, acknowledged' };
    }

    payment.rawWebhookData = eventPayload;

    // 3. Process Events
    if (type === 'PAYMENT_SUCCESS_WEBHOOK' || type === 'ORDER_PAID_SUCCESS') {
      const paymentAttempt = data?.payment || {};
      await this.fulfillOrder(payment, paymentAttempt);
    } else if (type === 'PAYMENT_FAILED_WEBHOOK') {
      payment.status = 'FAILED';
      if (data?.payment?.cf_payment_id) {
        payment.cfPaymentId = String(data.payment.cf_payment_id);
      }
      await payment.save();
    } else if (type === 'PAYMENT_USER_DROPPED_WEBHOOK') {
      payment.status = 'USER_DROPPED';
      await payment.save();
    }

    return { success: true, message: 'Webhook processed successfully' };
  }

  /**
   * Get single Payment by Order ID
   */
  async getPaymentByOrderId(orderId, requestingUser) {
    const payment = await Payment.findOne({ orderId })
      .populate('user', 'firstName lastName email phoneNumber')
      .populate('entityId')
      .populate('serviceBooking');

    if (!payment) {
      const err = new Error('Payment not found');
      err.statusCode = 404;
      throw err;
    }

    // If customer, ensure they only see their own order
    if (
      requestingUser.role === ROLES.CUSTOMER &&
      payment.user._id.toString() !== requestingUser._id.toString()
    ) {
      const err = new Error('You are not authorized to view this payment');
      err.statusCode = 403;
      throw err;
    }

    return payment;
  }

  /**
   * Get all payments for a specific customer
   */
  async getCustomerPayments(userId, { page = 1, limit = 20, status, entityType } = {}) {
    const filter = { user: userId };

    if (status) filter.status = status;
    if (entityType) filter.entityType = entityType;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate('entityId')
        .populate('serviceBooking')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Payment.countDocuments(filter)
    ]);

    return {
      payments,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      limit: limitNum
    };
  }

  /**
   * List all payment orders (Super Admin & Manager)
   */
  async getAllPayments({
    page = 1,
    limit = 20,
    status,
    entityType,
    search,
    startDate,
    endDate
  } = {}) {
    const filter = {};

    if (status) filter.status = status;
    if (entityType) filter.entityType = entityType;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    if (search) {
      filter.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { cfOrderId: { $regex: search, $options: 'i' } },
        { 'customerDetails.name': { $regex: search, $options: 'i' } },
        { 'customerDetails.email': { $regex: search, $options: 'i' } },
        { 'customerDetails.phone': { $regex: search, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [payments, total] = await Promise.all([
      Payment.find(filter)
        .populate('user', 'firstName lastName email phoneNumber')
        .populate('entityId')
        .populate('serviceBooking')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Payment.countDocuments(filter)
    ]);

    return {
      payments,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      limit: limitNum
    };
  }
}

export default new PaymentService();
