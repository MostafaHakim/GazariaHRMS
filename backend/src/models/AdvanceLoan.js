const mongoose = require("mongoose");
const cfg = require("../config/advanceConfig");

// প্রতিটি কিস্তি। পেরোল Mark Paid হলে deducted=true হয়।
const scheduleSchema = new mongoose.Schema({
  month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ }, // YYYY-MM
  amount: { type: Number, required: true, min: 0 },
  deducted: { type: Boolean, default: false },
  deductedAt: { type: Date, default: null },
  payrollMonth: { type: String, default: "" }, // কোন মাসের পেরোল থেকে আসলে কাটা হয়েছে
});

const advanceLoanSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    // স্ন্যাপশট (পরে কর্মীর তথ্য বদলালেও রেকর্ড একই থাকে)
    employeeId: { type: String, required: true, trim: true },
    employeeName: { type: String, required: true },
    department: { type: String, default: "" },
    section: { type: String, default: "" },

    type: { type: String, enum: cfg.TYPES, default: "ADVANCE" },
    category: { type: String, enum: cfg.CATEGORIES, default: "SALARY_ADVANCE" },

    amount: { type: Number, required: true, min: 1 },
    installments: { type: Number, default: 1, min: 1 },
    startMonth: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ }, // প্রথম কিস্তি কাটার মাস
    issueDate: { type: Date, default: null },
    reason: { type: String, default: "", trim: true },

    status: { type: String, enum: cfg.STATUSES, default: "PENDING" },

    // Approve হলে তৈরি হয়
    schedule: { type: [scheduleSchema], default: [] },

    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    requestedByName: { type: String, default: "" },
    requestedByRole: { type: String, default: "" },

    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    decidedByName: { type: String, default: "" },
    decidedAt: { type: Date, default: null },
    decisionNote: { type: String, default: "" },

    closedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

advanceLoanSchema.index({ company: 1, employee: 1, status: 1 });
advanceLoanSchema.index({ company: 1, status: 1, startMonth: 1 });
advanceLoanSchema.index({ "schedule.month": 1 });

module.exports = mongoose.model("AdvanceLoan", advanceLoanSchema);
