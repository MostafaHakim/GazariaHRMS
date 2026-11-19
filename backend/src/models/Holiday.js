const mongoose = require("mongoose");

const holidaySchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    date: {
      type: Date,
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    // GLOBAL = everyone (unless excluded)
    // CONDITIONAL = only matching religion / department
    type: {
      type: String,
      enum: ["GLOBAL", "CONDITIONAL"],
      default: "GLOBAL",
    },

    // Empty = all religions
    religions: {
      type: [String],
      default: [],
    },

    // Empty = all departments
    departments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Department",
      },
    ],

    // Departments that do NOT get this holiday (e.g. Security)
    excludeDepartments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Department",
      },
    ],

    // If employee works on this holiday, count as OT
    otIfWorked: {
      type: Boolean,
      default: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    remarks: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

holidaySchema.index({ company: 1, date: 1, isActive: 1 });

module.exports = mongoose.model("Holiday", holidaySchema);
