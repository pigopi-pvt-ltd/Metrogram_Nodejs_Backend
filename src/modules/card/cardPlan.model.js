import mongoose from 'mongoose';

const cardPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Card plan name is required'],
      trim: true,
      unique: true
    },
    planType: {
      type: String,
      enum: ['MONTHLY', 'YEARLY', 'QUARTERLY'],
      required: [true, 'Plan type is required (MONTHLY, YEARLY, or QUARTERLY)'],
      default: 'YEARLY'
    },
    price: {
      type: Number,
      required: [true, 'Card price is required'],
      min: [0, 'Price must be non-negative']
    },
    validityInDays: {
      type: Number,
      required: [true, 'Validity duration in days is required'],
      min: [1, 'Validity must be at least 1 day'],
      default: 365
    },
    description: {
      type: String,
      required: [true, 'Card plan description is required'],
      trim: true
    },
    benefits: {
      type: [String],
      required: [true, 'Card benefits must be provided'],
      default: []
    },
    discountPercentage: {
      type: Number,
      min: [0, 'Discount percentage cannot be less than 0'],
      max: [100, 'Discount percentage cannot exceed 100'],
      default: 0
    },
    badge: {
      type: String,
      trim: true,
      default: 'Standard'
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

const CardPlan = mongoose.model('CardPlan', cardPlanSchema);

export default CardPlan;
