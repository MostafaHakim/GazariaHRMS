const mongoose = require("mongoose");

// সপ্তাহের মাঝে নির্দিষ্ট দিনের জন্য শিফট বদল (যেমন মঙ্গলবার থেকে রাতের শিফট)
const dayOverrideSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true }, // UTC midnight of the BD calendar date
    shift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
      required: true,
    },
    remarks: { type: String, default: "" },
  },
  { _id: false },
);

const rosterEntrySchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    employeeId: {
      type: String,
      required: true,
    },

    employeeName: {
      type: String,
      required: true,
    },

    shift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
      required: true,
    },

    source: {
      type: String,
      enum: ["AUTO", "MANUAL"],
      default: "AUTO",
    },

    remarks: {
      type: String,
      default: "",
    },

    dayOverrides: {
      type: [dayOverrideSchema],
      default: [],
    },
  },
  { timestamps: true },
);

const weeklyRosterSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    weekStartDate: {
      type: Date,
      required: true,
    },

    weekEndDate: {
      type: Date,
      required: true,
    },

    entries: {
      type: [rosterEntrySchema],
      default: [],
    },

    status: {
      type: String,
      enum: ["DRAFT", "PUBLISHED"],
      default: "DRAFT",
    },

    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

weeklyRosterSchema.index({ company: 1, weekStartDate: 1 }, { unique: true });

weeklyRosterSchema.index({
  "entries.employee": 1,
});

module.exports = mongoose.model("WeeklyRoster", weeklyRosterSchema);
