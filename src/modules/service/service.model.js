import mongoose from 'mongoose';

const serviceSchema = new mongoose.Schema(
  {
    testName: {
      type: String,
      required: [true, 'Test name is required'],
      trim: true,
      index: true
    },
    description: {
      type: String,
      required: [true, 'Test description is required'],
      trim: true
    },
    testType: {
      type: String,
      required: [true, 'Test type/category is required'],
      trim: true,
      index: true
    },
    reportTime: {
      type: String,
      required: [true, 'Report turnaround time is required'],
      trim: true
    },
    sampleType: {
      type: String,
      required: [true, 'Sample type is required'],
      trim: true
    },
    price: {
      type: Number,
      required: [true, 'Standard price is required'],
      min: [0, 'Price must be non-negative']
    },
    discountedPrice: {
      type: Number,
      required: [true, 'Discounted price for card holders is required'],
      min: [0, 'Discounted price must be non-negative']
    },
    parametersMeasured: {
      type: [String],
      default: []
    },
    requiresFasting: {
      type: Boolean,
      default: false
    },
    fastingDuration: {
      type: String,
      trim: true,
      default: ''
    },
    preparationInstructions: {
      type: String,
      trim: true,
      default: ''
    },
    faqs: [
      {
        question: {
          type: String,
          required: [true, 'FAQ question is required'],
          trim: true
        },
        answer: {
          type: String,
          required: [true, 'FAQ answer is required'],
          trim: true
        }
      }
    ],
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

// Compound text index for fuzzy search across tests
serviceSchema.index({ testName: 'text', description: 'text', testType: 'text', sampleType: 'text' });

const Service = mongoose.model('Service', serviceSchema);

export default Service;
