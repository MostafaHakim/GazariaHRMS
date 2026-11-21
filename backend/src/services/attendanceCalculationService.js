const Employee = require("../models/Employee");
const AttendanceLog = require("../models/AttendanceLog");
const WeeklyRoster = require("../models/WeeklyRoster");
const Holiday = require("../models/Holiday");
const DailyAttendance = require("../models/DailyAttendance");
const Leave = require("../models/Leave");

const BD_OFFSET_HOURS = 6;

// কোম্পানির নিয়ম: শিফট শুরুর ১০ মিনিটের বেশি দেরি হলে LATE।
// (১০ মিনিট পর্যন্ত গ্রেস; ১১তম মিনিট থেকে লেট)। .env এ LATE_GRACE_MINUTES দিয়ে বদলানো যায়।
const LATE_GRACE_MINUTES = Number.isFinite(Number(process.env.LATE_GRACE_MINUTES))
  && process.env.LATE_GRACE_MINUTES !== undefined
  && process.env.LATE_GRACE_MINUTES !== ""
  ? Number(process.env.LATE_GRACE_MINUTES)
  : 10;

const getDateParts = (dateString) => {
  const [year, month, day] = dateString.split("-").map(Number);

  if (
    !year ||
    !month ||
    !day ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    throw new Error("Invalid date. Use YYYY-MM-DD format.");
  }

  const check = new Date(Date.UTC(year, month - 1, day));

  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new Error("Invalid calendar date.");
  }

  return { year, month, day };
};

const bdDateTimeToUTC = (dateString, timeString) => {
  const { year, month, day } = getDateParts(dateString);
  const [hour, minute] = timeString.split(":").map(Number);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error(`Invalid shift time: ${timeString}`);
  }

  return new Date(
    Date.UTC(year, month - 1, day, hour - BD_OFFSET_HOURS, minute),
  );
};

const getSaturdayDate = (dateString) => {
  const { year, month, day } = getDateParts(dateString);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay();
  const daysToSubtract = (dayOfWeek + 1) % 7;
  date.setUTCDate(date.getUTCDate() - daysToSubtract);

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
};

const minutesBetween = (start, end) => {
  return Math.max(0, Math.floor((end - start) / 60000));
};

const calculateOvertimeMinutes = (actualMinutes) => {
  const completedHours = Math.floor((actualMinutes + 5) / 60);
  return completedHours * 60;
};

const isFriday = (dateString) => {
  const { year, month, day } = getDateParts(dateString);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCDay() === 5;
};

const holidayAppliesToEmployee = (holiday, employee) => {
  if (!holiday || !holiday.isActive) return false;

  const empDeptId = employee.department
    ? employee.department._id
      ? employee.department._id.toString()
      : employee.department.toString()
    : null;

  if (
    empDeptId &&
    Array.isArray(holiday.excludeDepartments) &&
    holiday.excludeDepartments.some(
      (d) => (d._id || d).toString() === empDeptId,
    )
  ) {
    return false;
  }

  if (holiday.type === "GLOBAL") {
    if (Array.isArray(holiday.departments) && holiday.departments.length > 0) {
      if (!empDeptId) return false;
      return holiday.departments.some(
        (d) => (d._id || d).toString() === empDeptId,
      );
    }
    return true;
  }

  // CONDITIONAL
  const empReligion = String(employee.religion || "Other");
  if (Array.isArray(holiday.religions) && holiday.religions.length > 0) {
    if (!holiday.religions.includes(empReligion)) return false;
  }

  if (Array.isArray(holiday.departments) && holiday.departments.length > 0) {
    if (!empDeptId) return false;
    if (
      !holiday.departments.some((d) => (d._id || d).toString() === empDeptId)
    ) {
      return false;
    }
  }

  return true;
};

/**
 * 1) deviceMappings if set
 * 2) fallback: any device where deviceUserId === employeeId
 */
const findEmployeeLogs = async (employee, logStart, logEnd) => {
  const mappings = (employee.deviceMappings || []).filter(
    (m) => m.deviceId && m.deviceUserId,
  );

  if (mappings.length > 0) {
    const conditions = mappings.map((m) => ({
      deviceId: String(m.deviceId).trim(),
      deviceUserId: String(m.deviceUserId).trim(),
    }));
    return AttendanceLog.find({
      company: employee.company,
      $or: conditions,
      recordTime: { $gte: logStart, $lte: logEnd },
    }).sort({ recordTime: 1 });
  }

  const empId = String(employee.employeeId || "").trim();
  if (!empId) return [];

  return AttendanceLog.find({
    company: employee.company,
    deviceUserId: empId,
    recordTime: { $gte: logStart, $lte: logEnd },
  }).sort({ recordTime: 1 });
};

// একই কর্মীর পরপর পাঞ্চ এই সময়ের (মিনিট) মধ্যে হলে সব মিলিয়ে একটাই পাঞ্চ ধরা হয় (প্রথমটি)।
// একসাথে অনেকবার পাঞ্চ করলেও একটাই গণনা হবে। মূল Raw Log মোছা হয় না, শুধু হিসাবে বাদ যায়।
// .env এ PUNCH_DEDUPE_MINUTES দিয়ে বদলানো যায় (ডিফল্ট ৫ মিনিট)।
const PUNCH_DEDUPE_MINUTES = (() => {
  const raw = process.env.PUNCH_DEDUPE_MINUTES;
  const n = Number(raw);
  return raw !== undefined && raw !== "" && Number.isFinite(n) && n >= 0 ? n : 5;
})();

const dedupeLogs = (logs, windowMinutes = PUNCH_DEDUPE_MINUTES) => {
  const windowMs = windowMinutes * 60 * 1000;
  const sorted = [...logs].sort(
    (a, b) => new Date(a.recordTime) - new Date(b.recordTime),
  );

  const kept = [];
  for (const log of sorted) {
    const last = kept[kept.length - 1];
    // শেষ রাখা পাঞ্চ থেকে window এর মধ্যে হলে ডুপ্লিকেট; নইলে নতুন পাঞ্চ
    if (!last || new Date(log.recordTime) - new Date(last.recordTime) > windowMs) {
      kept.push(log);
    }
  }
  return kept;
};

const calculateDailyAttendance = async (dateString, options = {}) => {
  const onlyEmployeeIds = Array.isArray(options.employeeIds)
    ? new Set(options.employeeIds.map(String))
    : null;
  const { year, month, day } = getDateParts(dateString);
  const attendanceDate = new Date(Date.UTC(year, month - 1, day));
  const weekStartDate = getSaturdayDate(dateString);

  if (!options.companyId) throw new Error("Attendance calculation-এর জন্য Company ID আবশ্যক");
  const roster = await WeeklyRoster.findOne({
    company: options.companyId,
    weekStartDate: new Date(`${weekStartDate}T00:00:00.000Z`),
  })
    .populate("entries.shift")
    .populate("entries.dayOverrides.shift");

  if (!roster) {
    throw new Error(
      `${weekStartDate} সপ্তাহের Weekly Roster পাওয়া যায়নি। আগে Roster Generate করুন।`,
    );
  }

  const dayStart = new Date(Date.UTC(year, month - 1, day));
  const dayEnd = new Date(Date.UTC(year, month - 1, day + 1));
  const holidaysOnDate = await Holiday.find({
    company: options.companyId,
    isActive: true,
    date: { $gte: dayStart, $lt: dayEnd },
  }).lean();

  const friday = isFriday(dateString);

  // এই তারিখে Approved Leave আছে এমন কর্মী
  const leavesOnDate = await Leave.find({
    company: options.companyId,
    status: "APPROVED",
    fromDate: { $lte: dayStart },
    toDate: { $gte: dayStart },
  }).lean();
  const leaveByEmployee = new Map(
    leavesOnDate.map((l) => [String(l.employee), l]),
  );

  let processed = 0;
  let present = 0;
  let late = 0;
  let absent = 0;
  let incomplete = 0;
  let weeklyOff = 0;
  let holidayCount = 0;
  let leaveCount = 0;
  let skipped = 0;

  // ===== Bulk preload: কর্মী-প্রতি আলাদা কোয়েরির বদলে একবারেই সব আনা (Vercel-এ দ্রুত চলার জন্য) =====
  const Shift = require("../models/Shift");
  const entries = roster.entries.filter(
    (e) => !onlyEmployeeIds || onlyEmployeeIds.has(String(e.employee)),
  );

  const employees = await Employee.find({
    _id: { $in: entries.map((e) => e.employee) },
    company: options.companyId,
    isDeleted: { $ne: true },
  });
  const employeeMap = new Map(employees.map((e) => [String(e._id), e]));

  // populate না হওয়া শিফট (startTime নেই) একবারেই আনা
  const missingShiftIds = new Set();
  for (const e of entries) {
    const ov = (e.dayOverrides || []).find(
      (o) => o.date && new Date(o.date).getTime() === attendanceDate.getTime(),
    );
    const s = ov?.shift || e.shift;
    if (s && !s.startTime) missingShiftIds.add(String(s._id || s));
  }
  const shiftMap = new Map();
  if (missingShiftIds.size) {
    const shs = await Shift.find({ _id: { $in: [...missingShiftIds] } });
    for (const s of shs) shiftMap.set(String(s._id), s);
  }

  // সব কর্মীর লগ একটি কোয়েরিতে (সব শিফটের সম্ভাব্য সীমা ধরে), পরে মেমোরিতে ভাগ করা
  const DAY = 24 * 60 * 60 * 1000;
  const windowStart = new Date(attendanceDate.getTime() - 12 * 60 * 60 * 1000);
  const windowEnd = new Date(attendanceDate.getTime() + 2 * DAY);
  const allLogs = await AttendanceLog.find({
    company: options.companyId,
    recordTime: { $gte: windowStart, $lte: windowEnd },
  })
    .sort({ recordTime: 1 })
    .lean();
  const logsByDeviceUser = new Map(); // "deviceId|userId" -> logs
  const logsByUser = new Map(); // "userId" -> logs (deviceMapping না থাকলে)
  for (const l of allLogs) {
    const uid = String(l.deviceUserId || "").trim();
    const k = `${String(l.deviceId || "").trim()}|${uid}`;
    if (!logsByDeviceUser.has(k)) logsByDeviceUser.set(k, []);
    logsByDeviceUser.get(k).push(l);
    if (!logsByUser.has(uid)) logsByUser.set(uid, []);
    logsByUser.get(uid).push(l);
  }
  const pickLogs = (employee, from, to) => {
    const mappings = (employee.deviceMappings || []).filter((m) => m.deviceId && m.deviceUserId);
    let pool = [];
    if (mappings.length) {
      for (const m of mappings) {
        pool.push(...(logsByDeviceUser.get(`${String(m.deviceId).trim()}|${String(m.deviceUserId).trim()}`) || []));
      }
    } else {
      const empId = String(employee.employeeId || "").trim();
      if (empId) pool = logsByUser.get(empId) || [];
    }
    return pool
      .filter((l) => l.recordTime >= from && l.recordTime <= to)
      .sort((a, b) => a.recordTime - b.recordTime);
  };

  // ম্যানুয়ালি এডিট করা রেকর্ড একবারেই আনা
  const existing = await DailyAttendance.find({
    company: options.companyId,
    attendanceDate,
    employee: { $in: employees.map((e) => e._id) },
  })
    .select("employee isManuallyEdited")
    .lean();
  const manualSet = new Set(existing.filter((x) => x.isManuallyEdited).map((x) => String(x.employee)));

  const writeOps = [];

  for (const entry of entries) {
    const employee = employeeMap.get(String(entry.employee));

    if (!employee) {
      skipped++;
      continue;
    }

    const empStatus = String(employee.employmentStatus || "").toLowerCase();
    if (empStatus && empStatus !== "active") {
      skipped++;
      continue;
    }

    // Roster-ই একমাত্র সত্য: Plan থেকে তৈরি, Manual বদল সহ
    // সপ্তাহের মাঝে শিফট বদল (dayOverrides) থাকলে ঐ দিনের জন্য সেটিই ধরা হবে
    const dayOverride = (entry.dayOverrides || []).find(
      (o) => o.date && new Date(o.date).getTime() === attendanceDate.getTime(),
    );
    let shift = dayOverride?.shift || entry.shift;

    if (shift && !shift.startTime) {
      shift = shiftMap.get(String(shift._id || shift)) || null;
    }

    if (!shift || !shift.isActive) {
      skipped++;
      continue;
    }
    // A roster entry must never apply a Shift owned by another company.
    if (shift.company && String(shift.company._id || shift.company) !== String(employee.company)) {
      skipped++;
      continue;
    }

    const shiftStart = bdDateTimeToUTC(dateString, shift.startTime);
    let shiftEnd = bdDateTimeToUTC(dateString, shift.endTime);

    if (shiftEnd <= shiftStart) {
      shiftEnd = new Date(shiftEnd.getTime() + 24 * 60 * 60 * 1000);
    }

    const logStart = new Date(shiftStart.getTime() - 4 * 60 * 60 * 1000);
    const logEnd = new Date(shiftEnd.getTime() + 6 * 60 * 60 * 1000);

    const rawLogs = pickLogs(employee, logStart, logEnd);
    const dedupedLogs = dedupeLogs(rawLogs);

    const hasMapping =
      (employee.deviceMappings || []).filter((m) => m.deviceId && m.deviceUserId)
        .length > 0;

    let remarks = "";
    if (!hasMapping) {
      remarks = "Matched by employeeId (no device mapping)";
    }

    const firstLog = dedupedLogs.length > 0 ? dedupedLogs[0] : null;
    const lastLog =
      dedupedLogs.length > 1 ? dedupedLogs[dedupedLogs.length - 1] : null;

    const firstIn = firstLog ? firstLog.recordTime : null;
    const lastOut = lastLog ? lastLog.recordTime : null;

    const scheduledMinutes = minutesBetween(shiftStart, shiftEnd);
    const breakMinutes = Number(shift.breakMinutes || 0);

    let workedMinutes = 0;
    let netWorkedMinutes = 0;
    let lateMinutes = 0;
    let earlyLeaveMinutes = 0;
    let overtimeMinutes = 0;
    let status = "ABSENT";

    const applicableHoliday = holidaysOnDate.find((h) =>
      holidayAppliesToEmployee(h, employee),
    );

    // ---- Friday Weekly Off ----
    if (friday) {
      if (dedupedLogs.length >= 2) {
        workedMinutes = minutesBetween(firstIn, lastOut);
        netWorkedMinutes = Math.max(0, workedMinutes - breakMinutes);
        overtimeMinutes = calculateOvertimeMinutes(workedMinutes);
        status = "WEEKLY_OFF";
        remarks = "Friday weekly off — all worked time as OT";
      } else if (dedupedLogs.length === 1) {
        status = "WEEKLY_OFF";
        remarks = "Friday weekly off — single punch";
      } else {
        status = "WEEKLY_OFF";
        remarks = "Friday weekly off";
      }
    }
    // ---- Declared Holiday ----
    else if (applicableHoliday) {
      if (dedupedLogs.length >= 2) {
        workedMinutes = minutesBetween(firstIn, lastOut);
        netWorkedMinutes = Math.max(0, workedMinutes - breakMinutes);
        if (applicableHoliday.otIfWorked !== false) {
          overtimeMinutes = calculateOvertimeMinutes(workedMinutes);
          remarks = `Holiday (${applicableHoliday.name}) — worked as OT`;
        } else {
          remarks = `Holiday (${applicableHoliday.name}) — worked`;
        }
        status = "HOLIDAY";
      } else if (dedupedLogs.length === 1) {
        status = "HOLIDAY";
        remarks = `Holiday (${applicableHoliday.name}) — single punch`;
      } else {
        status = "HOLIDAY";
        remarks = `Holiday: ${applicableHoliday.name}`;
      }
    }
    // ---- Normal day ----
    // ---- Approved Leave (পাঞ্চ না থাকলে) ----
    else if (leaveByEmployee.has(String(employee._id)) && dedupedLogs.length === 0) {
      const lv = leaveByEmployee.get(String(employee._id));
      status = "LEAVE";
      remarks = `Leave (${lv.leaveType})`;
    } else if (dedupedLogs.length === 1) {
      status = "INCOMPLETE";
      remarks = remarks || "Only one punch found";
      // একটি পাঞ্চ থাকলেও দেরি হলে লেট মিনিট ধরা হবে (স্ট্যাটাস INCOMPLETE-ই থাকবে)
      const lateBy = firstIn ? minutesBetween(shiftStart, firstIn) : 0;
      if (lateBy > LATE_GRACE_MINUTES) {
        lateMinutes = lateBy;
        remarks = `Only one punch found — late ${lateBy} min`;
      }
    } else if (dedupedLogs.length >= 2) {
      workedMinutes = minutesBetween(firstIn, lastOut);
      netWorkedMinutes = Math.max(0, workedMinutes - breakMinutes);

      // মিনিট হিসাবে দেরি: ১০ মিনিটের বেশি হলেই LATE
      const lateBy = minutesBetween(shiftStart, firstIn);

      if (lateBy > LATE_GRACE_MINUTES) {
        lateMinutes = lateBy;
        status = "LATE";
      } else {
        status = "PRESENT";
      }

      if (lastOut < shiftEnd) {
        earlyLeaveMinutes = minutesBetween(lastOut, shiftEnd);
      }

      if (lastOut > shiftEnd) {
        overtimeMinutes = calculateOvertimeMinutes(
          minutesBetween(shiftEnd, lastOut),
        );
      }
    }

    if (manualSet.has(String(employee._id))) {
      skipped++;
      continue;
    }

    writeOps.push({
      updateOne: {
        filter: {
          company: employee.company,
          employee: employee._id,
          attendanceDate,
        },
        update: {
          $set: {
            company: employee.company,
            employeeId: employee.employeeId,
            employeeName: employee.name,
            shift: shift._id,
            shiftCode: shift.code,
            shiftStart,
            shiftEnd,
            firstIn,
            lastOut,
            punchCount: dedupedLogs.length,
            scheduledMinutes,
            breakMinutes,
            workedMinutes,
            netWorkedMinutes,
            lateMinutes,
            earlyLeaveMinutes,
            overtimeMinutes,
            status,
            sourceLogs: dedupedLogs.map((log) => log._id),
            remarks: dayOverride
              ? [remarks, `Mid-week shift: ${shift.code}`].filter(Boolean).join(" | ")
              : remarks,
            calculatedAt: new Date(),
          },
        },
        upsert: true,
      },
    });

    processed++;

    if (status === "PRESENT") present++;
    else if (status === "LATE") late++;
    else if (status === "ABSENT") absent++;
    else if (status === "INCOMPLETE") incomplete++;
    else if (status === "WEEKLY_OFF") weeklyOff++;
    else if (status === "HOLIDAY") holidayCount++;
    else if (status === "LEAVE") leaveCount++;
  }

  if (writeOps.length) {
    await DailyAttendance.bulkWrite(writeOps, { ordered: false });
  }

  return {
    date: dateString,
    weekStartDate,
    totalRosterEmployees: roster.entries.length,
    processed,
    present,
    late,
    absent,
    incomplete,
    weeklyOff,
    holiday: holidayCount,
    leave: leaveCount,
    skipped,
  };
};

module.exports = {
  calculateDailyAttendance,
  LATE_GRACE_MINUTES,
  PUNCH_DEDUPE_MINUTES,
  dedupeLogs,
};
