const mongoose = require("mongoose");

const departmentSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true, immutable: true },
  name: { type: String, required: true, trim: true },
  code: { type: String, trim: true, uppercase: true, default: "" },
  description: { type: String, default: "" },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

departmentSchema.index({ company: 1, name: 1 }, { unique: true, name: "company_department_name_unique" });
departmentSchema.index({ company: 1, code: 1 }, { unique: true, partialFilterExpression: { code: { $type: "string", $gt: "" } }, name: "company_department_code_unique" });

module.exports = mongoose.model("Department", departmentSchema);
