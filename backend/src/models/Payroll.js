const mongoose = require("mongoose");

const payrollRunSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ }, // YYYY-MM
    monthDays: { type: Number, required: true },
    status: { type: String, enum: ["DRAFT", "FINALIZED", "PAID"], default: "DRAFT" },

    generatedAt: { type: Date, default: Date.now },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    finalizedAt: { type: Date, default: null },
    finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    paidAt: { type: Date, default: null },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    note: { type: String, default: "" },
  },
  { timestamps: true },
);
payrollRunSchema.index({ company: 1, month: 1 }, { unique: true, name: "company_payroll_month_unique" });

// ইনপুট ফিল্ডগুলো ম্যানুয়ালি বদলানো যায়; বদলালে manualFields এ নাম থাকে,
// ফলে পরের Regenerate এ অ্যাটেনডেন্স থেকে ওভাররাইট হয় না।
const payrollLineSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    run: { type: mongoose.Schema.Types.ObjectId, ref: "PayrollRun", required: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },

    // স্ন্যাপশট (পরে কর্মীর তথ্য বদলালেও পুরনো পেরোল একই থাকে)
    department: { type: String, default: "" },
    section: { type: String, default: "" },
    employeeId: { type: String, required: true },
    name: { type: String, required: true },
    designation: { type: String, default: "" },

    monthDays: { type: Number, required: true },
    absent: { type: Number, default: 0 },
    leave: { type: Number, default: 0 },
    late: { type: Number, default: 0 },
    whDays: { type: Number, default: 0 },
    night: { type: Number, default: 0 },
    basicSalary: { type: Number, default: 0 },
    otDayHours: { type: Number, default: 0 },
    otNightHours: { type: Number, default: 0 },

    prevAdjAddition: { type: Number, default: 0 },
    prevAdjDeduction: { type: Number, default: 0 },
    advance: { type: Number, default: 0 }, // হাতে দেওয়া অতিরিক্ত অ্যাডভান্স (ইনপুট)

    // Advance & Loan মডিউল থেকে অনুমোদিত কিস্তি (অটো; Regenerate এ নতুন করে আসে, হাতে বদলানো যায় না)
    loanDeduction: { type: Number, default: 0 },
    loanRefs: {
      type: [
        {
          _id: false,
          loan: { type: mongoose.Schema.Types.ObjectId, ref: "AdvanceLoan" },
          entry: { type: mongoose.Schema.Types.ObjectId },
          month: { type: String, default: "" },
          amount: { type: Number, default: 0 },
          label: { type: String, default: "" },
        },
      ],
      default: [],
    },

    method: { type: String, enum: ["Bkash", "Bank", "Cash", "Hold"], default: "Cash" },
    accountNumber: { type: String, default: "" },
    remarks: { type: String, default: "" },

    // হিসাব করা মান (payrollCalc)
    present: { type: Number, default: 0 },
    payableDays: { type: Number, default: 0 },
    salaryPayable: { type: Number, default: 0 },
    otHours: { type: Number, default: 0 },
    otAmount: { type: Number, default: 0 },
    ot20: { type: Number, default: 0 },
    attBonus: { type: Number, default: 0 },
    nightAllowance: { type: Number, default: 0 },
    netPayable: { type: Number, default: 0 },

    // রিভিউয়ের জন্য: অ্যাটেনডেন্স থেকে আসা কিন্তু ঠিক করা দরকার এমন তথ্য
    incompleteDays: { type: Number, default: 0 },
    missingDays: { type: Number, default: 0 },

    manualFields: { type: [String], default: [] },
  },
  { timestamps: true },
);

payrollLineSchema.index({ run: 1, employee: 1 }, { unique: true });
payrollLineSchema.index({ run: 1, department: 1 });

module.exports = {
  PayrollRun: mongoose.model("PayrollRun", payrollRunSchema),
  PayrollLine: mongoose.model("PayrollLine", payrollLineSchema),
};
