import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLES, PROFILE_MODELS } from '../../constants/roles.js';

// Pre-register all polymorphic profile models with Mongoose
import '../superAdmin/superAdmin.model.js';
import '../manager/manager.model.js';
import '../employee/employee.model.js';
import '../customer/customer.model.js';

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters']
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters']
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address'
      ]
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false
    },
    phoneNumber: {
      type: String,
      trim: true
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: [true, 'User role is required']
    },
    // Dynamic reference to role-specific model
    profile: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'profileModel'
    },
    profileModel: {
      type: String,
      enum: Object.values(PROFILE_MODELS)
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
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

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to verify password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Virtual for full name
userSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

const User = mongoose.model('User', userSchema);

export default User;
