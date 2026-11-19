const mongoose = require('mongoose');
const shiftSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, uppercase: true, trim: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  graceMinutes: { type: Number, default: 0, min: 0 },
  breakMinutes: { type: Number, default: 0, min: 0 },
  overtimeAfterMinutes: { type: Number, default: 0, min: 0 },
  isNightShift: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  description: { type: String, default: '' },
}, { timestamps: true });
shiftSchema.index({ company: 1, code: 1 }, { unique: true, name: 'company_shift_code_unique' });
module.exports = mongoose.model('Shift', shiftSchema);
