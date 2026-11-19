const AttendanceLog = require("../models/AttendanceLog");
const DeviceSyncLog = require("../models/DeviceSyncLog");
const { syncPullDevice } = require("../services/deviceSyncService");
const Device = require("../models/Device");
const Employee = require("../models/Employee");
const Department = require("../models/Department");
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ---- Raw log ↔ Employee মিলানোর সহায়ক ফাংশন ----
// ম্যাপিং থাকলে (deviceId + deviceUserId), না থাকলে employeeId = deviceUserId ধরা হয়
const mappingKey = (deviceId, deviceUserId) =>
  `${String(deviceId).trim()}|${String(deviceUserId).trim()}`;

const buildEmployeeLogConditions = (employees) => {
  const pairs = [];
  const plainIds = [];

  for (const emp of employees) {
    const maps = (emp.deviceMappings || []).filter((m) => m.deviceId && m.deviceUserId);
    if (maps.length > 0) {
      for (const m of maps) {
        pairs.push({
          deviceId: String(m.deviceId).trim(),
          deviceUserId: String(m.deviceUserId).trim(),
        });
      }
    } else if (emp.employeeId) {
      plainIds.push(String(emp.employeeId).trim());
    }
  }

  const conditions = [...pairs];
  if (plainIds.length > 0) conditions.push({ deviceUserId: { $in: plainIds } });
  return conditions;
};

const attachEmployeeInfo = async (logs, companyId) => {
  if (logs.length === 0) return logs;

  const userIds = [...new Set(logs.map((l) => String(l.deviceUserId).trim()))];

  const employees = await Employee.find({
    company: companyId,
    isDeleted: { $ne: true },
    $or: [
      { employeeId: { $in: userIds } },
      { "deviceMappings.deviceUserId": { $in: userIds } },
    ],
  })
    .select("employeeId name section department deviceMappings")
    .populate("department", "name")
    .lean();

  const byMapping = new Map();
  const byEmployeeId = new Map();

  for (const emp of employees) {
    const maps = (emp.deviceMappings || []).filter((m) => m.deviceId && m.deviceUserId);
    if (maps.length > 0) {
      for (const m of maps) byMapping.set(mappingKey(m.deviceId, m.deviceUserId), emp);
    } else {
      byEmployeeId.set(String(emp.employeeId).trim(), emp);
    }
  }

  return logs.map((log) => {
    const emp =
      byMapping.get(mappingKey(log.deviceId, log.deviceUserId)) ||
      byEmployeeId.get(String(log.deviceUserId).trim());

    return {
      ...log,
      employeeCode: emp?.employeeId || "",
      employeeName: emp?.name || "",
      section: emp?.section || "",
      department: emp?.department?.name || "",
    };
  });
};

// GET /api/attendance/logs
// Query: page, limit, deviceId, startDate, endDate, section, department, search
//   section = "__NONE__" হলে section ছাড়া কর্মী
const getAttendanceLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

    const filter = { company: req.companyId };
    const andConditions = [];

    if (req.query.deviceId) {
      filter.deviceId = req.query.deviceId;
    }

    if (req.query.startDate || req.query.endDate) {
      filter.recordTime = {};

      // তারিখ Bangladesh সময় (UTC+6) ধরে: BD দিনের শুরু = আগের দিন 18:00 UTC
      if (req.query.startDate) {
        const startDate = new Date(`${String(req.query.startDate).slice(0, 10)}T00:00:00+06:00`);

        if (Number.isNaN(startDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid startDate",
          });
        }

        filter.recordTime.$gte = startDate;
      }

      if (req.query.endDate) {
        const endDate = new Date(`${String(req.query.endDate).slice(0, 10)}T23:59:59.999+06:00`);

        if (Number.isNaN(endDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid endDate",
          });
        }

        filter.recordTime.$lte = endDate;
      }
    }

    // Section / Department / Name-ID search → কর্মী খুঁজে তাদের Device ID দিয়ে লগ ফিল্টার
    const { section, department, search } = req.query;
    const searchText = String(search || "").trim();

    if (section || department || searchText) {
      const empFilter = { company: req.companyId, isDeleted: { $ne: true } };

      if (section === "__NONE__") {
        empFilter.$or = [{ section: "" }, { section: null }];
      } else if (section) {
        empFilter.section = section;
      }

      if (department) empFilter.department = department;

      if (searchText) {
        const escaped = searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = { $regex: escaped, $options: "i" };
        empFilter.$and = [
          {
            $or: [
              { employeeId: regex },
              { name: regex },
              { "deviceMappings.deviceUserId": regex },
            ],
          },
        ];
      }

      const matchedEmployees = await Employee.find(empFilter)
        .select("employeeId deviceMappings")
        .lean();

      const conditions = buildEmployeeLogConditions(matchedEmployees);

      // Section/Department ফিল্টারে কেউ না মিললে ফলাফল শূন্য
      if (conditions.length === 0 && (section || department || searchText)) {
        // শুধু Device User ID লিখে সার্চ করলে (কর্মী ম্যাপ না থাকলেও) সরাসরি মিলাই
        if (searchText && !section && !department) {
          andConditions.push({
            deviceUserId: { $regex: searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" },
          });
        } else {
          andConditions.push({ _id: { $in: [] } });
        }
      } else {
        if (searchText && !section && !department) {
          // নাম/ID মিললে + কাঁচা Device User ID সরাসরি মিললেও দেখাই
          conditions.push({
            deviceUserId: { $regex: searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" },
          });
        }
        andConditions.push({ $or: conditions });
      }
    }

    if (andConditions.length > 0) filter.$and = andConditions;

    const [rawLogs, total] = await Promise.all([
      AttendanceLog.find(filter)
        .sort({ recordTime: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("-rawData")
        .lean(),

      AttendanceLog.countDocuments(filter),
    ]);

    const logs = await attachEmployeeInfo(rawLogs, req.companyId);

    res.status(200).json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/attendance/filter-options → Device / Section / Department ড্রপডাউনের তালিকা
const getLogFilterOptions = async (req, res, next) => {
  try {
    const [sections, departments, devices] = await Promise.all([
      Employee.distinct("section", { company: req.companyId, isDeleted: { $ne: true } }),
      Department.find({ company: req.companyId, isActive: true }).select("name").sort({ name: 1 }).lean(),
      Device.find({ company: req.companyId, enabled: true }).select("deviceId name").lean(),
    ]);

    res.status(200).json({
      success: true,
      devices: devices.map((d) => ({ deviceId: d.deviceId, name: d.name })),
      sections: sections
        .map((x) => String(x || "").trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
      departments,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/attendance/sync-history
const getDeviceSyncHistory = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    const filter = { company: req.companyId };

    if (req.query.deviceId) {
      filter.deviceId = req.query.deviceId;
    }

    const [history, total] = await Promise.all([
      DeviceSyncLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      DeviceSyncLog.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      history,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/attendance/sync
// Body: { deviceId?, autoCalculate?, calculateDates? }
//   deviceId দিলে শুধু ওই ডিভাইস sync হবে; না দিলে কোম্পানির সব enabled PULL ডিভাইস।
const syncAttendanceFromDevices = async (req, res, next) => {
  try {
    const onlyDeviceId = String(req.body?.deviceId || "").trim().toUpperCase();

    const autoCalculateDates = Array.isArray(req.body?.calculateDates)
      ? req.body.calculateDates
      : req.body?.autoCalculate
        ? [new Date().toISOString().slice(0, 10)]
        : [];

    const deviceFilter = { company: req.companyId, enabled: true };
    if (onlyDeviceId) deviceFilter.deviceId = onlyDeviceId;

    const allDevices = await Device.find(deviceFilter).lean();
    const devices = allDevices.filter((d) => d.protocol !== "ADMS");
    const admsCount = allDevices.length - devices.length;

    const results = [];
    for (const device of devices) {
      results.push(await syncPullDevice(device));
    }

    const successCount = results.filter((i) => i.status === "Success").length;
    const failedCount = results.filter((i) => i.status === "Failed").length;
    const partialCount = results.filter((i) => i.status === "Partial").length;

    let calculationResults = [];
    if (autoCalculateDates.length > 0 && successCount + partialCount > 0) {
      const { calculateDailyAttendance } = require("../services/attendanceCalculationService");
      for (const dateStr of autoCalculateDates) {
        try {
          const calc = await calculateDailyAttendance(dateStr, { companyId: req.companyId });
          calculationResults.push({ date: dateStr, success: true, ...calc });
        } catch (calcErr) {
          calculationResults.push({ date: dateStr, success: false, error: calcErr.message });
        }
      }
    }

    let warning;
    if (devices.length === 0) {
      warning = admsCount > 0
        ? "এই কোম্পানির ডিভাইসগুলো ADMS Push মোডে — এগুলো নিজেই সার্ভারে punch পাঠায়, Sync লাগে না। LAN-এর (PULL) ডিভাইস থাকলে Attendance Devices পেজে Protocol \"PULL\" দিয়ে যোগ করুন।"
        : "এই কোম্পানিতে কোনো ডিভাইস যোগ করা নেই। Attendance Devices পেজ থেকে ডিভাইস যোগ করুন।";
    }

    res.status(200).json({
      success: true,
      message: "Attendance device sync completed",
      warning,
      summary: {
        totalDevices: devices.length,
        success: successCount,
        partial: partialCount,
        failed: failedCount,
        admsDevices: admsCount,
      },
      results,
      calculationResults: calculationResults.length > 0 ? calculationResults : undefined,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAttendanceLogs,
  getLogFilterOptions,
  getDeviceSyncHistory,
  syncAttendanceFromDevices,
};
