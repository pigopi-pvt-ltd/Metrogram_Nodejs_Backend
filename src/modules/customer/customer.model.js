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
