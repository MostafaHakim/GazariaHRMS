const Shift = require('../models/Shift');
const isValidTime = (v) => typeof v === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(v);
const getShifts = async (req, res, next) => { try {
  const filter = { company: req.companyId };
  if (req.query.status === 'active') filter.isActive = true;
  if (req.query.status === 'inactive') filter.isActive = false;
  const shifts = await Shift.find(filter).sort({ name: 1 });
  res.json({ success: true, shifts });
} catch (e) { next(e); } };
const createShift = async (req, res, next) => { try {
  const { name, code, startTime, endTime, graceMinutes, breakMinutes, overtimeAfterMinutes, isNightShift, description } = req.body;
  if (!name || !code || !isValidTime(startTime) || !isValidTime(endTime)) return res.status(400).json({ success:false, message:'Name, code and valid shift times are required' });
  const shift = await Shift.create({ company:req.companyId, name, code, startTime, endTime, graceMinutes, breakMinutes, overtimeAfterMinutes, isNightShift, description });
  res.status(201).json({ success:true, message:'Shift created successfully', shift });
} catch(e) { if(e.code===11000) return res.status(409).json({success:false,message:'এই কোম্পানিতে Shift code আগে থেকেই আছে'}); next(e); } };
const updateShift = async (req, res, next) => { try {
  const allowed = ['name','code','startTime','endTime','graceMinutes','breakMinutes','overtimeAfterMinutes','isNightShift','isActive','description'];
  const updates = {}; for (const f of allowed) if(req.body[f] !== undefined) updates[f]=req.body[f];
  if (updates.startTime !== undefined && !isValidTime(updates.startTime)) return res.status(400).json({success:false,message:'Invalid startTime. Use HH:mm'});
  if (updates.endTime !== undefined && !isValidTime(updates.endTime)) return res.status(400).json({success:false,message:'Invalid endTime. Use HH:mm'});
  const shift = await Shift.findOneAndUpdate({ _id:req.params.id, company:req.companyId }, updates, {new:true,runValidators:true});
  if(!shift) return res.status(404).json({success:false,message:'Shift not found in selected company'});
  res.json({success:true,message:'Shift updated successfully',shift});
} catch(e) { if(e.code===11000) return res.status(409).json({success:false,message:'এই কোম্পানিতে Shift code আগে থেকেই আছে'}); next(e); } };
module.exports = { getShifts, createShift, updateShift };
