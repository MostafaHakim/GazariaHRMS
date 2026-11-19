// LEGACY: শুধু scripts/migrateToRosterPlan.js-এর জন্য রাখা। নতুন কোড এটি ব্যবহার করে না।
const mongoose = require("mongoose");

const memberSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
  startShift: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", required: true },
  rotationEnabled: { type: Boolean, default: true },
  manualShift: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", default: null },
  anchorDate: { type: Date, required: true },
}, { _id: false });

const historySchema = new mongoose.Schema({
  action: { type: String, required: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", default: null },
  fromShift: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", default: null },
  toShift: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", default: null },
  remarks: { type: String, default: "" },
  changedAt: { type: Date, default: Date.now },
}, { _id: false });

const shiftRotationSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
  name: { type: String, required: true, trim: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", required: true },
  shifts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Shift", required: true }],
  members: { type: [memberSchema], default: [] },
  intervalDays: { type: Number, default: 7, min: 1 },
  startDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  pausedAt: { type: Date, default: null },
  history: { type: [historySchema], default: [] },
}, { timestamps: true });

shiftRotationSchema.index({ company: 1, department: 1, isActive: 1 });
shiftRotationSchema.index({ "members.employee": 1 });
module.exports = mongoose.model("ShiftRotation", shiftRotationSchema);
