import mongoose from 'mongoose';

const superAdminSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    adminLevel: {
      type: String,
      default: 'SUPER_LEVEL_1',
      trim: true
    },
    permissions: {
      type: [String],
      default: ['*']
    },
    systemNotes: {
      type: String,
      default: 'Primary system administrator profile'
    }
  },
  {
    timestamps: true
  }
);

const SuperAdmin = mongoose.model('SuperAdmin', superAdminSchema);

export default SuperAdmin;
