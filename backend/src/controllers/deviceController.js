const Device = require('../models/Device');
const DeviceSyncLog = require('../models/DeviceSyncLog');
const Employee = require('../models/Employee');
const { syncPullDevice, testPullConnection } = require('../services/deviceSyncService');

const DUP_MESSAGE = 'Device ID অথবা Serial Number আগে থেকেই ব্যবহৃত';
const clean = (v) => (v === undefined || v === null ? '' : String(v).trim());

// protocol অনুযায়ী আবশ্যক তথ্য যাচাই (খালি হলে null)
const validateDevice = (d) => {
  if (!d.deviceId || !d.name) return 'Device ID ও Device Name আবশ্যক';
  if (d.protocol === 'ADMS' && !d.serialNumber) return 'ADMS ডিভাইসের জন্য Serial Number আবশ্যক';
  if (d.protocol !== 'ADMS' && !d.ip) return 'PULL (LAN) ডিভাইসের জন্য IP Address আবশ্যক';
  return null;
};

// প্রতিটি ডিভাইসের সর্বশেষ sync ফলাফলসহ তালিকা
const listDevices = async (req, res, next) => { try {
  const devices = await Device.find({ company: req.companyId }).sort({ name: 1 }).lean();
  const latest = await DeviceSyncLog.aggregate([
    { $match: { company: req.companyId } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$deviceId', doc: { $first: '$$ROOT' } } },
  ]);
  const byDevice = new Map(latest.map((x) => [x._id, x.doc]));
  res.json({
    success: true,
    devices: devices.map((d) => ({ ...d, lastSync: byDevice.get(d.deviceId) || null })),
  });
} catch (e) { next(e); } };

const createDevice = async (req, res, next) => { try {
  const b = req.body || {};
  const data = {
    company: req.companyId,
    deviceId: clean(b.deviceId),
    name: clean(b.name),
    model: clean(b.model),
    ip: clean(b.ip),
    port: Number(b.port) || 4370,
    commKey: Number(b.commKey) || 0,
    protocol: b.protocol === 'ADMS' ? 'ADMS' : 'PULL',
    enabled: b.enabled !== false,
  };
  const serial = clean(b.serialNumber);
  if (serial) data.serialNumber = serial;

  const problem = validateDevice({ ...data, serialNumber: serial });
  if (problem) return res.status(400).json({ success: false, message: problem });

  const device = await Device.create(data);
  res.status(201).json({ success: true, device });
} catch (e) { if (e.code === 11000) return res.status(409).json({ success: false, message: DUP_MESSAGE }); next(e); } };

const updateDevice = async (req, res, next) => { try {
  const device = await Device.findOne({ _id: req.params.id, company: req.companyId });
  if (!device) return res.status(404).json({ success: false, message: 'Device পাওয়া যায়নি' });

  const b = req.body || {};
  for (const f of ['deviceId', 'name', 'model', 'ip']) if (b[f] !== undefined) device[f] = clean(b[f]);
  if (b.port !== undefined) device.port = Number(b.port) || 4370;
  if (b.commKey !== undefined) device.commKey = Number(b.commKey) || 0;
  if (b.protocol !== undefined) device.protocol = b.protocol === 'ADMS' ? 'ADMS' : 'PULL';
  if (b.enabled !== undefined) device.enabled = !!b.enabled;
  if (b.serialNumber !== undefined) device.serialNumber = clean(b.serialNumber) || undefined;

  const problem = validateDevice(device);
  if (problem) return res.status(400).json({ success: false, message: problem });

  await device.save();
  res.json({ success: true, device });
} catch (e) { if (e.code === 11000) return res.status(409).json({ success: false, message: DUP_MESSAGE }); next(e); } };

const deleteDevice = async (req, res, next) => { try {
  const device = await Device.findOneAndUpdate({ _id: req.params.id, company: req.companyId }, { enabled: false }, { new: true });
  if (!device) return res.status(404).json({ success: false, message: 'Device পাওয়া যায়নি' });
  res.json({ success: true, message: 'Device disabled', device });
} catch (e) { next(e); } };

// POST /devices/:id/test — শুধু সংযোগ পরীক্ষা
const testDevice = async (req, res, next) => { try {
  const device = await Device.findOne({ _id: req.params.id, company: req.companyId }).lean();
  if (!device) return res.status(404).json({ success: false, message: 'Device পাওয়া যায়নি' });

  if (device.protocol === 'ADMS') {
    const seen = device.lastSeenAt ? new Date(device.lastSeenAt) : null;
    const online = !!seen && Date.now() - seen.getTime() < 10 * 60 * 1000;
    return res.json({
      success: true,
      ok: online,
      protocol: 'ADMS',
      lastSeenAt: seen,
      message: online
        ? 'ডিভাইস সম্প্রতি সার্ভারে সংকেত পাঠিয়েছে'
        : seen
          ? 'ডিভাইস গত ১০ মিনিটে কোনো সংকেত পাঠায়নি'
          : 'ডিভাইস এখনো সার্ভারে কোনো সংকেত পাঠায়নি — ডিভাইসের Cloud Server Setting-এ সার্ভারের IP/Port এবং Serial Number মিলিয়ে দেখুন',
    });
  }

  const result = await testPullConnection(device);
  res.json({ success: true, ...result });
} catch (e) { next(e); } };

// POST /devices/:id/sync — শুধু এই একটি ডিভাইস থেকে punch আনা
const syncDevice = async (req, res, next) => { try {
  const device = await Device.findOne({ _id: req.params.id, company: req.companyId }).lean();
  if (!device) return res.status(404).json({ success: false, message: 'Device পাওয়া যায়নি' });
  if (!device.enabled) return res.status(400).json({ success: false, message: 'ডিভাইসটি Disabled — আগে Enable করুন' });
  if (device.protocol === 'ADMS') {
    return res.status(400).json({ success: false, message: 'ADMS ডিভাইস নিজেই সার্ভারে punch পাঠায়; এখান থেকে Sync করার দরকার নেই' });
  }
  const result = await syncPullDevice(device);
  res.json({ success: true, result });
} catch (e) { next(e); } };

const mapEmployeeDevice = async (req, res, next) => { try {
  const { employeeId, deviceUserId } = req.body;
  if (!employeeId || !deviceUserId) return res.status(400).json({ success: false, message: 'Employee ID ও Device User ID আবশ্যক' });
  const device = await Device.findOne({ _id: req.params.id, company: req.companyId, enabled: true });
  if (!device) return res.status(404).json({ success: false, message: 'Active device পাওয়া যায়নি' });
  const employee = await Employee.findOne({ company: req.companyId, employeeId: String(employeeId).trim().toUpperCase(), isDeleted: { $ne: true } });
  if (!employee) return res.status(404).json({ success: false, message: 'এই কোম্পানিতে Employee পাওয়া যায়নি' });
  employee.deviceMappings = (employee.deviceMappings || []).filter((m) => String(m.deviceId) !== device.deviceId);
  employee.deviceMappings.push({ deviceId: device.deviceId, deviceUserId: String(deviceUserId).trim() });
  await employee.save();
  res.json({ success: true, message: 'Device mapping saved', employeeId: employee.employeeId, deviceId: device.deviceId, deviceUserId: String(deviceUserId).trim() });
} catch (e) { next(e); } };

module.exports = { listDevices, createDevice, updateDevice, deleteDevice, testDevice, syncDevice, mapEmployeeDevice };
