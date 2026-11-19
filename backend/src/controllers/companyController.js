const Company = require('../models/Company');

exports.listCompanies = async (req, res, next) => {
  try {
    const filter = {};
    // ADMIN ?all=1 দিলে নিষ্ক্রিয় কোম্পানিও দেখতে পারবে (Companies পেজের জন্য)
    if (!(req.user.role === 'ADMIN' && req.query.all === '1')) filter.isActive = true;
    // ADMIN is the Group Admin role in this project.
    if (req.user.role !== 'ADMIN') {
      filter._id = { $in: req.user.companyAccess || [] };
    }
    const companies = await Company.find(filter).sort({ name: 1 }).lean();
    res.json({ success: true, companies });
  } catch (error) { next(error); }
};

exports.createCompany = async (req, res, next) => {
  try {
    const { name, code, legalName, address, phone, email } = req.body || {};
    if (!String(name || '').trim() || !String(code || '').trim()) return res.status(400).json({ success: false, message: 'Company name and code are required' });
    const company = await Company.create({ name, code, legalName, address, phone, email });
    res.status(201).json({ success: true, company });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Company code already exists' });
    next(error);
  }
};

exports.updateCompany = async (req, res, next) => {
  try {
    const updates = {};
    for (const key of ['name', 'code', 'legalName', 'address', 'phone', 'email', 'isActive']) {
      if (req.body?.[key] !== undefined) updates[key] = req.body[key];
    }
    const company = await Company.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!company) return res.status(404).json({ success: false, message: 'Company not found' });
    res.json({ success: true, company });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Company code already exists' });
    next(error);
  }
};
