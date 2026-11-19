const mongoose = require("mongoose");

const dailyAttendanceSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },

    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    employeeId: {
      type: String,
      required: true,
      trim: true,
    },

    employeeName: {
      type: String,
      required: true,
    },

    attendanceDate: {
      type: Date,
      required: true,
    },

    shift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
      default: null,
    },

    shiftCode: {
      type: String,
      default: "",
    },

    shiftStart: {
      type: Date,
      default: null,
    },

    shiftEnd: {
      type: Date,
      default: null,
    },

    firstIn: {
      type: Date,
      default: null,
    },

    lastOut: {
      type: Date,
      default: null,
    },

    punchCount: {
      type: Number,
      default: 0,
    },

    scheduledMinutes: {
      type: Number,
      default: 0,
    },

    breakMinutes: {
      type: Number,
      default: 0,
    },

    workedMinutes: {
      type: Number,
      default: 0,
    },

    netWorkedMinutes: {
      type: Number,
      default: 0,
    },

    lateMinutes: {
      type: Number,
      default: 0,
    },

    earlyLeaveMinutes: {
      type: Number,
      default: 0,
    },

    overtimeMinutes: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: [
        "PRESENT",
        "LATE",
        "ABSENT",
        "INCOMPLETE",
        "WEEKLY_OFF",
        "HOLIDAY",
        "LEAVE",
      ],
      default: "ABSENT",
    },

    sourceLogs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AttendanceLog",
      },
    ],

    remarks: {
      type: String,
      default: "",
    },

    isManuallyEdited: {
      type: Boolean,
      default: false,
    },

    calculatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

// একজন কর্মীর একটি তারিখে একটি Attendance Record
dailyAttendanceSchema.index(
  { company: 1, employee: 1, attendanceDate: 1 },
  { unique: true },
);

dailyAttendanceSchema.index({ company: 1, attendanceDate: 1, status: 1 });
dailyAttendanceSchema.index({ employeeId: 1, attendanceDate: -1 });

module.exports = mongoose.model("DailyAttendance", dailyAttendanceSchema);
