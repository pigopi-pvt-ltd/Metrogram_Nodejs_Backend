import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    employeeCode: {
      type: String,
      trim: true,
      unique: true,
      sparse: true
    },
    designation: {
      type: String,
      trim: true,
      default: 'Staff Associate'
    },
    department: {
      type: String,
      trim: true,
      default: 'Operations'
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Manager',
      default: null
    },
    joiningDate: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

const Employee = mongoose.model('Employee', employeeSchema);

export default Employee;
