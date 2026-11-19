const mongoose = require("mongoose");

const designationSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true, immutable: true },
  name: { type: String, required: true, trim: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
  description: { type: String, default: "" },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

designationSchema.index({ company: 1, name: 1, department: 1 }, { unique: true, name: "company_designation_department_unique" });

module.exports = mongoose.model("Designation", designationSchema);
