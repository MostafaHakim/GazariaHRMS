const mongoose = require("mongoose");

const attendanceLogSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },

    deviceId: {
      type: String,
      required: true,
      trim: true,
    },

    deviceIp: {
      type: String,
      required: true,
    },

    userSn: {
      type: String,
      default: "",
    },

    deviceUserId: {
      type: String,
      required: true,
      trim: true,
    },

    recordTime: {
      type: Date,
      required: true,
    },

    // ডিভাইসের Raw Data-তে ip থাকলে সেটি আলাদাভাবে রাখব
    sourceIp: {
      type: String,
      default: "",
    },

    // Original device record
    rawData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

// একই Punch যেন দ্বিতীয়বার Save না হয়
attendanceLogSchema.index(
  {
    company: 1,
    deviceId: 1,
    userSn: 1,
    deviceUserId: 1,
    recordTime: 1,
  },
  {
    unique: true,
    name: "unique_company_device_attendance_log",
  },
);

// Date অনুযায়ী দ্রুত Search করার জন্য
attendanceLogSchema.index({ company: 1, recordTime: -1 });

attendanceLogSchema.index({
  recordTime: -1,
});

attendanceLogSchema.index({
  deviceId: 1,
  recordTime: -1,
});

module.exports = mongoose.model("AttendanceLog", attendanceLogSchema);
