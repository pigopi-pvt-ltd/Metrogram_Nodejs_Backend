import mongoose from 'mongoose';

const franchiseEnquirySchema = new mongoose.Schema(
  {
    enquiryCode: {
      type: String,
      unique: true,
      trim: true,
      index: true
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [100, 'Full name cannot exceed 100 characters']
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address'
      ]
    },
    phone: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true
    },
    location: {
      type: String,
      required: [true, 'Preferred franchise location is required'],
      trim: true,
      maxlength: [150, 'Location cannot exceed 150 characters']
    },
    currentOccupation: {
      type: String,
      required: [true, 'Current occupation is required'],
      trim: true,
      maxlength: [150, 'Current occupation cannot exceed 150 characters']
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true
    },
    pincode: {
      type: String,
      trim: true,
      default: ''
    },
    addressWithCode: {
      type: String,
      trim: true,
      default: ''
    },
    notes: {
      type: String,
      trim: true,
      default: ''
    },
    status: {
      type: String,
      enum: ['PENDING', 'CONTACTED', 'IN_REVIEW', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true
    },
    adminNotes: {
      type: String,
      trim: true,
      default: ''
    },
    contactedAt: {
      type: Date,
      default: null
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
    },
    ipAddress: {
      type: String,
      default: ''
    },
    userAgent: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

// Pre-save hook: Generate unique human-readable enquiry code & sync addressWithCode
franchiseEnquirySchema.pre('save', function (next) {
  if (!this.enquiryCode) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.enquiryCode = `FRN-${timestamp}-${rand}`;
  }

  // Format addressWithCode if not explicitly provided
  if (!this.addressWithCode) {
    if (this.pincode) {
      this.addressWithCode = `${this.address}, Code/PIN: ${this.pincode}`;
    } else {
      this.addressWithCode = this.address;
    }
  }

  next();
});

// Indexes for searching, filtering, and performance
franchiseEnquirySchema.index({ email: 1 });
franchiseEnquirySchema.index({ phone: 1 });
franchiseEnquirySchema.index({ createdAt: -1 });

const FranchiseEnquiry = mongoose.model('FranchiseEnquiry', franchiseEnquirySchema);

export default FranchiseEnquiry;
