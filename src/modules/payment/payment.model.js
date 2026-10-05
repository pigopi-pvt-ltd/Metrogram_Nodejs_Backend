import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: [true, 'Order ID is required'],
      unique: true,
      trim: true,
      index: true
    },
    cfOrderId: {
      type: String,
      trim: true,
      default: null,
      index: true
    },
    entityType: {
      type: String,
      enum: ['CARD', 'SERVICE'],
      required: [true, 'Entity type is required (CARD or SERVICE)']
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'entityModel',
      required: [true, 'Entity reference ID is required']
    },
    entityModel: {
      type: String,
      enum: ['CardPlan', 'Service'],
      required: [true, 'Entity model name is required']
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0, 'Amount cannot be negative']
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED', 'USER_DROPPED', 'CANCELLED', 'REFUNDED'],
      default: 'PENDING',
      index: true
    },
    paymentSessionId: {
      type: String,
      trim: true,
      default: null
    },
    cfPaymentId: {
      type: String,
      trim: true,
      default: null
    },
    paymentMethod: {
      type: String,
      trim: true,
      default: null
    },
    paymentGroup: {
      type: String,
      trim: true,
      default: null
    },
    paymentTime: {
      type: Date,
      default: null
    },
    isFulfilled: {
      type: Boolean,
      default: false,
      index: true
    },
    fulfilledAt: {
      type: Date,
      default: null
    },
    customerDetails: {
      name: { type: String, trim: true },
      email: { type: String, trim: true },
      phone: { type: String, trim: true }
    },
    serviceBooking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceBooking',
      default: null
    },
    cardDetails: {
      planName: { type: String },
      planType: { type: String },
      validityInDays: { type: Number },
      discountPercentage: { type: Number },
      cardNumber: { type: String }
    },
    bookingDetails: {
      testName: { type: String },
      sampleType: { type: String },
      reportTime: { type: String },
      patientName: { type: String, trim: true },
      patientAge: { type: Number },
      patientGender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER'] },
      patientPhone: { type: String, trim: true },
      patientEmail: { type: String, trim: true },
      scheduledDate: { type: Date },
      timeSlot: { type: String, trim: true },
      collectionType: {
        type: String,
        enum: ['HOME_COLLECTION', 'LAB_VISIT'],
        default: 'LAB_VISIT'
      },
      address: {
        street: { type: String, trim: true },
        city: { type: String, trim: true },
        state: { type: String, trim: true },
        zipCode: { type: String, trim: true }
      },
      notes: { type: String, trim: true }
    },
    rawWebhookData: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Indexes for fast dashboard and user lookups
paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ status: 1, entityType: 1 });

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment;
