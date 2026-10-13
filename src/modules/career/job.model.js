import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true
    },
    location: {
      type: String,
      default: 'Patna, Bihar',
      trim: true
    },
    jobType: {
      type: String,
      enum: ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP'],
      default: 'FULL_TIME'
    },
    workplaceType: {
      type: String,
      enum: ['ON_SITE', 'REMOTE', 'HYBRID'],
      default: 'ON_SITE'
    },
    experienceLevel: {
      type: String,
      trim: true,
      default: '1-3 Years'
    },
    education: {
      type: String,
      trim: true,
      default: ''
    },
    salary: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 0 },
      currency: { type: String, default: 'INR' },
      period: {
        type: String,
        enum: ['PER_MONTH', 'PER_ANNUM', 'NEGOTIABLE'],
        default: 'PER_MONTH'
      },
      isDisclosed: { type: Boolean, default: true },
      displayText: { type: String, trim: true, default: '' }
    },
    description: {
      type: String,
      required: [true, 'Job description is required'],
      trim: true
    },
    responsibilities: [
      {
        type: String,
        trim: true
      }
    ],
    requirements: [
      {
        type: String,
        trim: true
      }
    ],
    benefits: [
      {
        type: String,
        trim: true
      }
    ],
    skills: [
      {
        type: String,
        trim: true
      }
    ],
    openings: {
      type: Number,
      default: 1,
      min: [1, 'Openings must be at least 1']
    },
    deadline: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ['OPEN', 'CLOSED', 'DRAFT'],
      default: 'OPEN'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    applicationCount: {
      type: Number,
      default: 0
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

// Slug generator pre-save middleware
jobSchema.pre('save', function (next) {
  if (this.isModified('title') || !this.slug) {
    const rawSlug = this.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
    this.slug = `${rawSlug}-${Math.random().toString(36).substring(2, 7)}`;
  }
  next();
});

// Indexes for high-performance querying
jobSchema.index({ isActive: 1, status: 1 });
jobSchema.index({ department: 1 });
jobSchema.index({ jobType: 1 });
jobSchema.index({ workplaceType: 1 });
jobSchema.index({ createdAt: -1 });

const Job = mongoose.model('Job', jobSchema);

export default Job;
