const AuditLog = require("../models/AuditLog");
exports.writeAudit = async (req, { action, module, targetId = "", details = {} }) => {
  try {
    await AuditLog.create({ company: req.companyId || null, actor: req.user?._id || null, actorName: req.user?.name || "System", actorRole: req.user?.role || "SYSTEM", action, module, targetId: String(targetId || ""), details, ip: req.ip || "" });
  } catch (error) { console.error("Audit log write failed:", error.message); }
};
