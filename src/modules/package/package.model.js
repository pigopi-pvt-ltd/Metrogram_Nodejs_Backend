import mongoose from 'mongoose';

const packageSchema = new mongoose.Schema(
  {
    packageName: {
      type: String,
      required: [true, 'Package name is required'],
      trim: true,
      index: true
    },
    description: {
      type: String,
      required: [true, 'Package description is required'],
      trim: true
    },
    packageType: {
      type: String,
      trim: true,
      default: 'Comprehensive Health Package',
      index: true
    },
    testType: {
      type: String,
      trim: true,
      default: 'Package'
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
    hospitalName: {
      type: String,
      trim: true,
      default: ''
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
    testsIncluded: {
      type: [String],
      default: []
    },
    tests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service'
      }
    ],
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
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual alias to support 'testName' interchangeably with 'packageName'
packageSchema
  .virtual('testName')
  .get(function () {
    return this.packageName;
  })
  .set(function (value) {
    this.packageName = value;
  });

// Compound text index for fuzzy search across packages
packageSchema.index({
  packageName: 'text',
  description: 'text',
  packageType: 'text',
  sampleType: 'text'
});

const Package = mongoose.model('Package', packageSchema);

export default Package;
