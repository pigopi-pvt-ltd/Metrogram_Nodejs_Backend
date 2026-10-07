import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    customerCode: {
      type: String,
      trim: true,
      unique: true,
      sparse: true
    },
    membershipType: {
      type: String,
      enum: ['REGULAR', 'PREMIUM', 'VIP'],
      default: 'REGULAR'
    },
    aadharNumber: {
      type: String,
      trim: true,
      sparse: true,
      default: null
    },
    panNumber: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true,
      default: null
    },
    hasCard: {
      type: Boolean,
      default: false
    },
    activeCard: {
      cardPlan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CardPlan',
        default: null
      },
      planName: { type: String, default: null },
      planType: { type: String, default: null },
      cardNumber: { type: String, default: null },
      price: { type: Number, default: 0 },
      purchasedAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null },
      status: {
        type: String,
        enum: ['ACTIVE', 'SUCCESS', 'EXPIRED', 'CANCELLED', 'NONE'],
        default: 'NONE'
      }
    },
    cardHistory: [
      {
        cardPlan: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'CardPlan'
        },
        planName: { type: String },
        planType: { type: String },
        cardNumber: { type: String },
        price: { type: Number },
        purchasedAt: { type: Date, default: Date.now },
        expiresAt: { type: Date },
        assignedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        paymentStatus: {
          type: String,
          default: 'COMPLETED'
        }
      }
    ],
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      zipCode: { type: String, trim: true },
      country: { type: String, trim: true }
    },
    loyaltyPoints: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

const Customer = mongoose.model('Customer', customerSchema);

export default Customer;
