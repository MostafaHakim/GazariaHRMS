const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  deviceId: { type: String, required: true, trim: true, uppercase: true },
  name: { type: String, required: true, trim: true },
  serialNumber: { type: String, trim: true, default: undefined },
  model: { type: String, trim: true, default: '' },
  ip: { type: String, trim: true, default: '' },
  port: { type: Number, default: 4370 },
  commKey: { type: Number, default: 0 },
  protocol: { type: String, enum: ['PULL', 'ADMS'], default: 'PULL' },
  enabled: { type: Boolean, default: true },
  lastSeenAt: { type: Date, default: null },
  lastSeenIp: { type: String, default: '' },
}, { timestamps: true });

deviceSchema.index({ company: 1, deviceId: 1 }, { unique: true });
deviceSchema.index({ serialNumber: 1 }, { unique: true, sparse: true });
module.exports = mongoose.model('Device', deviceSchema);
