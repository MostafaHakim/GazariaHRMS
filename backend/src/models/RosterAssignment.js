const mongoose = require("mongoose");

/**
 * একজন কর্মীর শিফট প্যাটার্ন (Single Source of Truth)।
 *  - FIXED  : shifts[0] সবসময়
 *  - ROTATE : shifts[] ক্রমানুযায়ী, প্রতি intervalWeeks সপ্তাহ পর পর পরের শিফট
 * effectiveFrom (শনিবার) থেকে প্যাটার্নটি কার্যকর। পরে বদলাতে চাইলে নতুন
 * effectiveFrom সহ নতুন রেকর্ড যোগ হয়; আগের রেকর্ড আগের সপ্তাহগুলোর জন্য থাকে।
 */
const rosterAssignmentSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    type: { type: String, enum: ["FIXED", "ROTATE"], required: true },
    shifts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Shift", required: true }],
    startIndex: { type: Number, default: 0, min: 0 },
    intervalWeeks: { type: Number, default: 1, min: 1, max: 52 },
    effectiveFrom: { type: Date, required: true },
  },
  { timestamps: true },
);

rosterAssignmentSchema.index({ company: 1, employee: 1, effectiveFrom: 1 }, { unique: true });

module.exports = mongoose.model("RosterAssignment", rosterAssignmentSchema);
