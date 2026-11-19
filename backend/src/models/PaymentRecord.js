const mongoose = require("mongoose");
const paymentRecordSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  payrollRun: { type: mongoose.Schema.Types.ObjectId, ref: "PayrollRun", default: null },
  month: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
  employeeId: { type: String, default: "" },
  employeeName: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0.01 },
  method: { type: String, enum: ["BKASH", "BANK", "CASH", "OTHER"], required: true },
  accountNumber: { type: String, default: "" },
  transactionRef: { type: String, default: "", trim: true },
  paidAt: { type: Date, required: true, default: Date.now },
  note: { type: String, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });
paymentRecordSchema.index({ company: 1, month: 1, paidAt: -1 });
// Payroll-generated payments are unique per employee within a payroll run.
// Partial filter keeps manual records (without payrollRun/employee) unrestricted.
paymentRecordSchema.index(
  { company: 1, payrollRun: 1, employee: 1 },
  {
    unique: true,
    name: "company_payroll_employee_payment_unique",
    partialFilterExpression: {
      payrollRun: { $type: "objectId" },
      employee: { $type: "objectId" },
    },
  },
);
module.exports = mongoose.model("PaymentRecord", paymentRecordSchema);
