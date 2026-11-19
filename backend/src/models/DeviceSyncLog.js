const mongoose = require("mongoose");

const deviceSyncLogSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },

    deviceId: {
      type: String,
      required: true,
    },

    deviceName: {
      type: String,
      default: "",
    },

    deviceIp: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["Success", "Partial", "Failed"],
      required: true,
    },

    totalRecords: {
      type: Number,
      default: 0,
    },

    insertedRecords: {
      type: Number,
      default: 0,
    },

    duplicateRecords: {
      type: Number,
      default: 0,
    },

    errorMessage: {
      type: String,
      default: "",
    },

    startedAt: {
      type: Date,
      default: Date.now,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

deviceSyncLogSchema.index({
  company: 1,
  deviceId: 1,
  createdAt: -1,
});

module.exports = mongoose.model("DeviceSyncLog", deviceSyncLogSchema);
