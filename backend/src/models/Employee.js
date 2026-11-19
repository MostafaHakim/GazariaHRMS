const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
      immutable: true,
    },

    employeeId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    nameBangla: {
      type: String,
      trim: true,
      default: "",
    },

    fatherName: {
      type: String,
      trim: true,
      default: "",
    },

    motherName: {
      type: String,
      trim: true,
      default: "",
    },

    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
      default: "Male",
    },

    religion: {
      type: String,
      enum: ["Hindu", "Muslim", "Christian", "Buddhist", "Other"],
      default: "Other",
    },

    dateOfBirth: {
      type: Date,
      default: null,
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },
    shift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
      default: null,
    },

    shiftPolicy: {
      type: String,
      enum: ["AUTO", "ROTATING", "WOMEN_DAY_ONLY", "FIXED"],
      default: "AUTO",
    },

    rotationStartDate: {
      type: Date,
      default: null,
    },

    rotationStartShift: {
      type: String,
      enum: ["DAY", "NIGHT"],
      default: "DAY",
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: "",
    },

    presentAddress: {
      type: String,
      default: "",
    },

    permanentAddress: {
      type: String,
      default: "",
    },

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null,
    },

    designation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Designation",
      default: null,
    },

    section: {
      type: String,
      trim: true,
      default: "",
    },

    joiningDate: {
      type: Date,
      required: true,
    },

    employmentType: {
      type: String,
      enum: ["Permanent", "Probation", "Contract", "Temporary"],
      default: "Probation",
    },

    employmentStatus: {
      type: String,
      enum: ["Active", "Inactive", "Resigned", "Terminated"],
      default: "Active",
    },

    bloodGroup: {
      type: String,
      default: "",
    },

    nidNumber: {
      type: String,
      trim: true,
      default: "",
    },

    grossSalary: {
      type: Number,
      min: 0,
      default: 0,
    },

    basicSalary: {
      type: Number,
      min: 0,
      default: 0,
    },

    deviceMappings: [
      {
        deviceId: {
          type: String,
          required: true,
        },
        deviceUserId: {
          type: String,
          required: true,
        },
      },
    ],

    // পেরোল পেমেন্ট (Payroll Sheet এর Method ও BKASH/BANK ACCOUNT NUMBER)
    paymentMethod: {
      type: String,
      enum: ["Bkash", "Bank", "Cash", "Hold"],
      default: "Cash",
    },

    paymentAccount: {
      type: String,
      trim: true,
      default: "",
    },

    photo: {
      type: String,
      default: "",
    },

    remarks: {
      type: String,
      default: "",
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

employeeSchema.index({ company: 1, employeeId: 1 }, { unique: true, name: "company_employeeId_unique" });
employeeSchema.index({ name: 1 });
employeeSchema.index({ department: 1 });
employeeSchema.index({ employmentStatus: 1 });

module.exports = mongoose.model("Employee", employeeSchema);
