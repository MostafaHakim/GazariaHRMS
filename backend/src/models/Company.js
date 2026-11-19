const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true, uppercase: true, unique: true },
  legalName: { type: String, trim: true, default: '' },
  address: { type: String, trim: true, default: '' },
  phone: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, lowercase: true, default: '' },
  isActive: { type: Boolean, default: true },
  settings: {
    timezone: { type: String, default: 'Asia/Dhaka' },
    currency: { type: String, default: 'BDT' },
  },
}, { timestamps: true });

companySchema.index({ name: 1 });
module.exports = mongoose.model('Company', companySchema);
