const mongoose = require("mongoose");

const LEAVE_TYPES = ["CASUAL", "SICK", "ANNUAL", "MATERNITY", "UNPAID", "OTHER"];
const LEAVE_STATUS = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];

const leaveSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    employeeId: { type: String, required: true, trim: true },
    employeeName: { type: String, required: true },

    leaveType: { type: String, enum: LEAVE_TYPES, default: "CASUAL" },

    // BD calendar dates stored as UTC midnight (DailyAttendance.attendanceDate এর মতো)
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    totalDays: { type: Number, required: true, min: 1 },

    reason: { type: String, default: "", trim: true },

    status: { type: String, enum: LEAVE_STATUS, default: "APPROVED" },
    decisionNote: { type: String, default: "" },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

leaveSchema.index({ company: 1, employee: 1, fromDate: 1, toDate: 1 });
leaveSchema.index({ company: 1, status: 1, fromDate: 1, toDate: 1 });

leaveSchema.statics.LEAVE_TYPES = LEAVE_TYPES;
leaveSchema.statics.LEAVE_STATUS = LEAVE_STATUS;

module.exports = mongoose.model("Leave", leaveSchema);
