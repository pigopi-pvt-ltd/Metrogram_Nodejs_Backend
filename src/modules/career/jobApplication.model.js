import mongoose from 'mongoose';

const jobApplicationSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: [true, 'Job reference is required']
    },
    applicationCode: {
      type: String,
      unique: true,
      trim: true
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true
    },
    alternatePhone: {
      type: String,
      trim: true,
      default: ''
    },
    currentLocation: {
      type: String,
      trim: true,
      default: ''
    },
    highestQualification: {
      type: String,
      trim: true,
      default: ''
    },
    totalExperience: {
      type: String,
      trim: true,
      default: ''
    },
    currentCompany: {
      type: String,
      trim: true,
      default: ''
    },
    currentDesignation: {
      type: String,
      trim: true,
      default: ''
    },
    currentSalary: {
      type: String,
      trim: true,
      default: ''
    },
    expectedSalary: {
      type: String,
      trim: true,
      default: ''
    },
    noticePeriod: {
      type: String,
      trim: true,
      default: ''
    },
    portfolioUrl: {
      type: String,
      trim: true,
      default: ''
    },
    linkedinUrl: {
      type: String,
      trim: true,
      default: ''
    },
    coverLetter: {
      type: String,
      trim: true,
      default: ''
    },
    resumeUrl: {
      type: String,
      required: [true, 'Resume document is required'],
      trim: true
    },
    resumePublicId: {
      type: String,
      default: null
    },
    resumeOriginalName: {
      type: String,
      default: ''
    },
    resumeResourceType: {
      type: String,
      default: 'auto'
    },
    resumeSize: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['APPLIED', 'IN_REVIEW', 'SHORTLISTED', 'REJECTED', 'HIRED'],
      default: 'APPLIED'
    },
    adminNotes: {
      type: String,
      trim: true,
      default: ''
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Pre-save hook to generate unique human-readable application code
jobApplicationSchema.pre('save', function (next) {
  if (!this.applicationCode) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.applicationCode = `APP-${timestamp}-${rand}`;
  }
  next();
});

// Indexes for admin lookups and applicant deduplication
jobApplicationSchema.index({ job: 1, email: 1 });
jobApplicationSchema.index({ status: 1 });
jobApplicationSchema.index({ createdAt: -1 });

const JobApplication = mongoose.model('JobApplication', jobApplicationSchema);

export default JobApplication;
