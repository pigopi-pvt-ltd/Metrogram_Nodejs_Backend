import mongoose from 'mongoose';

const managerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    department: {
      type: String,
      trim: true,
      default: 'General Management'
    },
    branch: {
      type: String,
      trim: true,
      default: 'Headquarters'
    },
    managedEmployees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
      }
    ],
    maxTeamSize: {
      type: Number,
      default: 20
    }
  },
  {
    timestamps: true
  }
);

const Manager = mongoose.model('Manager', managerSchema);

export default Manager;
