import mongoose from 'mongoose';

const packageBookingSchema = new mongoose.Schema(
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
    package: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Package',
      required: [true, 'Package reference is required']
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
    hospitalName: {
      type: String,
      trim: true,
      default: ''
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
    cancellationReason: {
      type: String,
      trim: true,
      default: ''
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
    refundStatus: {
      type: String,
      enum: ['PENDING', 'PROCESSED', 'FAILED', 'NOT_APPLICABLE'],
      default: 'NOT_APPLICABLE'
    },
    handledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual alias so any generic booking consumer can access booking.service
packageBookingSchema.virtual('service').get(function () {
  return this.package;
});

// Index for quick queries
packageBookingSchema.index({ customer: 1, createdAt: -1 });

const PackageBooking = mongoose.model('PackageBooking', packageBookingSchema);

export default PackageBooking;
