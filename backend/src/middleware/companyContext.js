const mongoose = require('mongoose');
const Company = require('../models/Company');
const { canAccessCompany } = require('../utils/companyAccess');

// Attach this middleware to a business-module route only after that module's
// controllers have been updated to include req.companyId in EVERY query/write.
const requireCompany = async (req, res, next) => {
  try {
    const companyId = String(req.header('X-Company-Id') || '').trim();
    if (!companyId || !mongoose.isValidObjectId(companyId)) {
      return res.status(400).json({ success: false, code: 'COMPANY_REQUIRED', message: 'Select a company first' });
    }
    const allowed = canAccessCompany(req.user, companyId);
    if (!allowed) return res.status(403).json({ success: false, code: 'COMPANY_FORBIDDEN', message: 'You do not have access to this company' });
    const company = await Company.findOne({ _id: companyId, isActive: true }).select('_id name code').lean();
    if (!company) return res.status(404).json({ success: false, code: 'COMPANY_NOT_FOUND', message: 'Company not found or inactive' });
    req.company = company;
    req.companyId = company._id;
    next();
  } catch (error) { next(error); }
};

module.exports = { requireCompany };
