const mongoose = require("mongoose");
const auditLogSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  actorName: { type: String, default: "" },
  actorRole: { type: String, default: "" },
  action: { type: String, required: true, index: true },
  module: { type: String, required: true, index: true },
  targetId: { type: String, default: "" },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  ip: { type: String, default: "" },
}, { timestamps: true });
auditLogSchema.index({ company: 1, createdAt: -1 });
module.exports = mongoose.model("AuditLog", auditLogSchema);
