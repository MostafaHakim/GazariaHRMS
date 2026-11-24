const mongoose = require("mongoose");
const Employee = require("../models/Employee");
const AttendanceLog = require("../models/AttendanceLog");
const { writeAudit } = require("../services/auditService");

// Web Punch: ফিঙ্গারপ্রিন্ট ডিভাইস নেই এমন ইউনিটে (যেমন Megabox) সিকিউরিটি/সুপারভাইজার নিজের মোবাইল অ্যাপ থেকে
// তার জন্য নির্ধারিত কর্মীদের IN/OUT দেয়। সার্ভারের সময়ে একটি AttendanceLog তৈরি হয় — ডিভাইসের পাঞ্চের মতোই,
// তাই Daily Attendance, Job Card, Payroll সব আগের নিয়মেই কাজ করে। পাঞ্চ এডিট/ডিলিটের কোনো API এখানে নেই।
const WEB_DEVICE_ID = "WEB";
const BD_OFFSET_MS = 6 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

// IN করে এত ঘণ্টার বেশি পার হলে সেটিকে "খোলা IN" ধরা হয় না (OUT ভুলে গেলে পরদিন নতুন IN দেওয়া যাবে)
const MAX_OPEN_HOURS = Number(process.env.WEB_PUNCH_MAX_OPEN_HOURS) || 18;

// হিসাবের সার্ভিসে PUNCH_DEDUPE_MINUTES এর মধ্যের পাঞ্চ একটাই ধরা হয়; তাই এর মধ্যে দ্বিতীয় পাঞ্চ নিলে OUT হারিয়ে যেত।
const COOLDOWN_MINUTES = (() => {
  const raw = process.env.PUNCH_DEDUPE_MINUTES;
  const n = Number(raw);
  return raw !== undefined && raw !== "" && Number.isFinite(n) && n >= 0 ? n : 5;
})();

const fail = (status, message, extra = {}) => Object.assign(new Error(message), { status, extra });
const normIp = (ip) => String(ip || "").replace(/^::ffff:/, "");

// WEB_PUNCH_ALLOWED_IPS দিলে শুধু সেই নেটওয়ার্ক থেকে পাঞ্চ হবে ("192.168.1." = সাবনেট, না হলে নির্দিষ্ট IP)। ফাঁকা = সব জায়গা
const ipAllowed = (req) => {
  const list = (process.env.WEB_PUNCH_ALLOWED_IPS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!list.length) return true;
  const ip = normIp(req.ip);
  return list.some((p) => (p.endsWith(".") ? ip.startsWith(p) : ip === p));
};

const bdDayStartUtc = (dateStr) => {
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d) - BD_OFFSET_MS);
  }
  const bd = new Date(Date.now() + BD_OFFSET_MS);
  return new Date(Date.UTC(bd.getUTCFullYear(), bd.getUTCMonth(), bd.getUTCDate()) - BD_OFFSET_MS);
};

const allowedIds = (req) => (req.user.punchEmployees || []).map(String);

const loadAllowedEmployees = async (req, onlyId = null) => {
  const ids = allowedIds(req);
  if (onlyId) {
    if (!mongoose.isValidObjectId(onlyId) || !ids.includes(String(onlyId))) {
      throw fail(403, "এই কর্মীর পাঞ্চ দেওয়ার অনুমতি আপনার নেই");
    }
  }
  const filter = {
    _id: onlyId ? onlyId : { $in: ids },
    isDeleted: { $ne: true },
    employmentStatus: "Active",
    company: { $in: req.user.companyAccess || [] },
  };
  const list = await Employee.find(filter).sort({ employeeId: 1 });
  if (onlyId && !list.length) throw fail(404, "কর্মী পাওয়া যায়নি বা Active নন");
  return list;
};

const logKey = (company, employeeId) => `${String(company)}|${employeeId}`;

// একসাথে সব কর্মীর অবস্থা + নির্বাচিত দিনের পাঞ্চ
const buildBoard = async (employees, dateStr) => {
  if (!employees.length) return [];
  const dayStart = bdDayStartUtc(dateStr);
  const dayEnd = new Date(dayStart.getTime() + 24 * HOUR);
  const since = new Date(Math.min(dayStart.getTime(), Date.now() - MAX_OPEN_HOURS * HOUR));

  const logs = await AttendanceLog.find({
    company: { $in: [...new Set(employees.map((e) => String(e.company)))] },
    deviceId: WEB_DEVICE_ID,
    deviceUserId: { $in: employees.map((e) => e.employeeId) },
    recordTime: { $gte: since },
  })
    .sort({ recordTime: 1 })
    .select("company deviceUserId recordTime rawData.action")
    .lean();

  const byEmp = new Map();
  for (const l of logs) {
    const k = logKey(l.company, l.deviceUserId);
    if (!byEmp.has(k)) byEmp.set(k, []);
    byEmp.get(k).push({ action: l.rawData?.action || "", time: l.recordTime });
  }

  const openSince = Date.now() - MAX_OPEN_HOURS * HOUR;
  return employees.map((e) => {
    const mine = byEmp.get(logKey(e.company, e.employeeId)) || [];
    const last = mine[mine.length - 1] || null;
    const isIn = !!last && last.action === "IN" && new Date(last.time).getTime() >= openSince;
    return {
      id: String(e._id),
      name: e.name,
      nameBangla: e.nameBangla || "",
      employeeId: e.employeeId,
      section: e.section || "",
      state: isIn ? "IN" : "OUT",
      lastPunch: last,
      punches: mine.filter((p) => new Date(p.time) >= dayStart && new Date(p.time) < dayEnd),
    };
  });
};

// GET /api/punch/employees?date=YYYY-MM-DD
exports.listBoard = async (req, res, next) => {
  try {
    const employees = await loadAllowedEmployees(req);
    const board = await buildBoard(employees, req.query.date);
    res.json({
      success: true,
      serverTime: new Date(),
      allowedHere: ipAllowed(req),
      cooldownMinutes: COOLDOWN_MINUTES,
      employees: board,
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

const doPunch = (action) => async (req, res, next) => {
  try {
    if (!ipAllowed(req)) {
      return res.status(403).json({
        success: false,
        code: "IP_NOT_ALLOWED",
        message: "এই নেটওয়ার্ক থেকে পাঞ্চ দেওয়া যাবে না",
      });
    }

    const [employee] = await loadAllowedEmployees(req, req.params.id);
    const [state] = await buildBoard([employee]);
    const last = state.lastPunch;
    const now = new Date(); // সময় সবসময় সার্ভার থেকে — মোবাইলের ঘড়ির উপর নির্ভর নয়

    if (action === "IN" && state.state === "IN") throw fail(409, `${employee.name} আগেই IN আছে। এখন OUT দিন।`);
    if (action === "OUT" && state.state !== "IN") throw fail(409, `আগে ${employee.name}-এর IN দিন, তারপর OUT।`);

    if (last) {
      const diffMin = (now - new Date(last.time)) / 60000;
      if (diffMin < COOLDOWN_MINUTES) {
        const wait = Math.ceil(COOLDOWN_MINUTES - diffMin);
        throw fail(429, `একটু অপেক্ষা করুন — আরও ${wait} মিনিট পর চাপুন।`);
      }
    }

    // কর্মীর Device Mapping থাকলে হিসাব শুধু সেই ম্যাপিং ধরে লগ খোঁজে; তাই WEB ম্যাপিংও যোগ করে দিই
    const mappings = (employee.deviceMappings || []).filter((m) => m.deviceId && m.deviceUserId);
    if (mappings.length && !mappings.some((m) => String(m.deviceId).toUpperCase() === WEB_DEVICE_ID)) {
      await Employee.updateOne(
        { _id: employee._id },
        { $push: { deviceMappings: { deviceId: WEB_DEVICE_ID, deviceUserId: employee.employeeId } } },
      );
    }

    const ip = normIp(req.ip);
    try {
      await AttendanceLog.create({
        company: employee.company,
        deviceId: WEB_DEVICE_ID,
        deviceIp: ip || "WEB",
        userSn: "",
        deviceUserId: employee.employeeId,
        recordTime: now,
        sourceIp: ip,
        rawData: {
          protocol: "WEB",
          action,
          operatorId: String(req.user._id),
          operatorName: req.user.name,
          userAgent: String(req.headers["user-agent"] || "").slice(0, 200),
        },
      });
    } catch (e) {
      if (e.code === 11000) throw fail(409, "পাঞ্চ আগেই নেওয়া হয়েছে");
      throw e;
    }

    req.companyId = employee.company;
    await writeAudit(req, {
      action: action === "IN" ? "WEB_PUNCH_IN" : "WEB_PUNCH_OUT",
      module: "ATTENDANCE",
      targetId: employee._id,
      details: { employeeId: employee.employeeId, employeeName: employee.name, time: now, ip },
    });

    const [updated] = await buildBoard([employee]);
    res.status(201).json({ success: true, action, time: now, employee: updated });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message, ...error.extra });
    next(error);
  }
};

exports.punchIn = doPunch("IN");
exports.punchOut = doPunch("OUT");
