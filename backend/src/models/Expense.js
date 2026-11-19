const mongoose = require("mongoose");
const expenseSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  date: { type: Date, required: true, index: true },
  category: { type: String, required: true, trim: true },
  description: { type: String, default: "", trim: true },
  amount: { type: Number, required: true, min: 0.01 },
  paymentMethod: { type: String, enum: ["CASH", "BANK", "BKASH", "OTHER"], default: "CASH" },
  reference: { type: String, default: "", trim: true },
  status: { type: String, enum: ["RECORDED", "VOID"], default: "RECORDED" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });
expenseSchema.index({ company: 1, date: -1 });
module.exports = mongoose.model("Expense", expenseSchema);
