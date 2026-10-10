import mongoose from 'mongoose';

const serviceBookingSchema = new mongoose.Schema(
  {
    bookingCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer user reference is required'],
      index: true
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Diagnostic service reference is required']
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null
    },
    amountPaid: {
      type: Number,
      required: [true, 'Amount paid is required'],
      min: 0
    },
    originalPrice: {
      type: Number,
      default: 0
    },
    discountApplied: {
      type: Number,
      default: 0
    },
    isCardDiscountApplied: {
      type: Boolean,
      default: false
    },
    bookingStatus: {
      type: String,
      enum: ['CONFIRMED', 'SAMPLE_COLLECTED', 'PROCESSING', 'COMPLETED', 'CANCELLED'],
      default: 'CONFIRMED',
      index: true
    },
    paymentStatus: {
      type: String,
      enum: ['PAID', 'PENDING', 'FAILED', 'REFUNDED'],
      default: 'PAID',
      index: true
    },
    patientDetails: {
      name: { type: String, required: true, trim: true },
      age: { type: Number },
      gender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER'] },
      phone: { type: String, trim: true },
      email: { type: String, trim: true }
    },
    collectionType: {
      type: String,
      enum: ['HOME_COLLECTION', 'LAB_VISIT'],
      default: 'LAB_VISIT'
    },
    collectionAddress: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      zipCode: { type: String, trim: true }
    },
    scheduledDate: {
      type: Date,
      default: null
    },
    timeSlot: {
      type: String,
      trim: true,
      default: ''
    },
    sampleCollectedAt: {
      type: Date,
      default: null
    },
    reportReadyAt: {
      type: Date,
      default: null
    },
    reportUrl: {
      type: String,
      trim: true,
      default: null
    },
    reportPublicId: {
      type: String,
      trim: true,
      default: null
    },
    reportAccessToken: {
      type: String,
      trim: true,
      default: null,
      index: true
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    },
    handledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    cancellationReason: {
      type: String,
      trim: true,
      default: null
    },
    cancelledAt: {
      type: Date,
      default: null
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    refundId: {
      type: String,
      trim: true,
      default: null
    },
    refundAmount: {
      type: Number,
      default: 0
    },
    refundStatus: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED', 'NOT_APPLICABLE', null],
      default: null
    }
  },
  {
    timestamps: true
  }
);

serviceBookingSchema.index({ customer: 1, createdAt: -1 });

const ServiceBooking = mongoose.model('ServiceBooking', serviceBookingSchema);

export default ServiceBooking;
