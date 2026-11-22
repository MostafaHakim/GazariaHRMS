const Employee = require("../models/Employee");
const DailyAttendance = require("../models/DailyAttendance");
const Shift = require("../models/Shift");
const { PayrollRun, PayrollLine } = require("../models/Payroll");
const cfg = require("../config/payrollConfig");
const { computeLine } = require("./payrollCalc");
const { loadLoanDeductions } = require("./advanceService");

// এই ফিল্ডগুলো অ্যাটেনডেন্স/কর্মীর তথ্য থেকে অটো আসে; হাতে বদলালে manualFields এ যায়
const AUTO_FIELDS = [
  "absent", "leave", "late", "whDays", "night",
  "otDayHours", "otNightHours", "basicSalary", "method", "accountNumber",
];
// এগুলো সবসময় ইনপুট (Regenerate এ কখনো মুছে যায় না)
const INPUT_FIELDS = ["prevAdjAddition", "prevAdjDeduction", "advance", "remarks"];
const NUMERIC_FIELDS = [
  "absent", "leave", "late", "whDays", "night", "otDayHours", "otNightHours",
  "basicSalary", "prevAdjAddition", "prevAdjDeduction", "advance",
];

const monthRange = (month) => {
  const [y, m] = month.split("-").map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, 1)),
    end: new Date(Date.UTC(y, m, 1)),
    monthDays: new Date(Date.UTC(y, m, 0)).getUTCDate(),
  };
};

const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

// মাসের অ্যাটেনডেন্স থেকে প্রতি কর্মীর স্ট্যাটস
const loadAttendanceStats = async (month, companyId, employeeIds = null) => {
  const { start, end, monthDays } = monthRange(month);
  // মাসের আগের/পরের ১ দিন সহ আনা: ১ তারিখ শুক্রবার হলে বৃহস্পতিবার (আগের মাস),
  // শেষ তারিখ শুক্রবার হলে শনিবার (পরের মাস) দেখতে হয়
  const DAY = 24 * 60 * 60 * 1000;
  const filter = {
    company: companyId,
    attendanceDate: {
      $gte: new Date(start.getTime() - cfg.HOLIDAY_SCAN_DAYS * DAY),
      $lt: new Date(end.getTime() + cfg.HOLIDAY_SCAN_DAYS * DAY),
    },
  };
  if (employeeIds) filter.employee = { $in: employeeIds };

  const [allRecords, shifts] = await Promise.all([
    DailyAttendance.find(filter)
      .select("employee attendanceDate status shift shiftCode overtimeMinutes punchCount remarks")
      .lean(),
    Shift.find({ company: companyId }).select("_id code isNightShift").lean(),
  ]);

  // শুধু এই মাসের রেকর্ড গোনা হবে; আশপাশের দিন শুধু স্যান্ডউইচ যাচাইয়ের জন্য
  const records = allRecords.filter((r) => r.attendanceDate >= start && r.attendanceDate < end);

  const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
  const byEmpDay = new Map(); // "empId|YYYY-MM-DD" -> record
  for (const r of allRecords) byEmpDay.set(`${r.employee}|${dayKey(r.attendanceDate)}`, r);

  // এই দিনটি কি "Absent" ধরা হয়? (পেরোলের নিজস্ব নিয়ম অনুযায়ী)
  const isAbsentDay = (empId, date) => {
    const r = byEmpDay.get(`${empId}|${dayKey(date)}`);
    if (!r) {
      // রেকর্ড না থাকা দিন মাসের ভেতরে হলে Absent গণ্য (missingDays এর মতোই); মাসের বাইরে হলে অজানা = Absent নয়
      return date >= start && date < end;
    }
    if (r.status === "ABSENT") return true;
    if (r.status === "INCOMPLETE" && cfg.INCOMPLETE_AS_ABSENT) return true;
    if (r.status === "LEAVE" && cfg.UNPAID_LEAVE_AS_ABSENT && /\(UNPAID\)/i.test(r.remarks || "")) return true;
    return false;
  };

  // হলিডের আগে/পরের "কর্মদিবস" খোঁজা: WEEKLY_OFF/HOLIDAY দিন বাদ দিয়ে প্রথম দিনটি।
  // সেই দিন Absent হলে true, উপস্থিত হলে false, তথ্য না থাকলে (মাসের বাইরে/সীমার বাইরে) null
  const workingDayAbsent = (empId, date, dir) => {
    for (let i = 1; i <= cfg.HOLIDAY_SCAN_DAYS; i++) {
      const d = new Date(date.getTime() + dir * i * DAY);
      const r = byEmpDay.get(`${empId}|${dayKey(d)}`);
      if (!r) return d >= start && d < end ? true : null;
      if (r.status === "WEEKLY_OFF" || r.status === "HOLIDAY") continue;
      return isAbsentDay(empId, d);
    }
    return null;
  };

  const nightById = new Map(shifts.map((s) => [String(s._id), !!s.isNightShift]));
  const nightByCode = new Map(shifts.map((s) => [s.code, !!s.isNightShift]));
  const stats = new Map();

  for (const r of records) {
    const key = String(r.employee);
    let s = stats.get(key);
    if (!s) {
      s = {
        recorded: 0, present: 0, late: 0, absent: 0, incomplete: 0,
        weeklyOff: 0, holiday: 0, leave: 0, unpaidLeave: 0,
        night: 0, otDayMin: 0, otNightMin: 0, sandwich: 0, holidaySandwich: 0,
      };
      stats.set(key, s);
    }
    const isNight =
      (r.shift && nightById.get(String(r.shift))) ||
      (r.shiftCode && nightByCode.get(r.shiftCode)) ||
      false;

    s.recorded++;
    switch (r.status) {
      case "PRESENT": s.present++; break;
      case "LATE": s.late++; break;
      case "ABSENT": s.absent++; break;
      case "INCOMPLETE": s.incomplete++; break;
      case "WEEKLY_OFF": {
        // শুক্রবার: আগের দিন (বৃহস্পতি) বা পরের দিন (শনি) Absent থাকলে শুক্রবারও Absent, ছুটির বেতন নেই।
        // শুক্রবার কাজ করে থাকলে (২+ পাঞ্চ) এটি খাটে না।
        const d = new Date(r.attendanceDate);
        const worked = (r.punchCount || 0) >= 2 || (r.overtimeMinutes || 0) > 0;
        if (
          cfg.FRIDAY_SANDWICH_ABSENT &&
          d.getUTCDay() === 5 &&
          !worked &&
          (isAbsentDay(key, new Date(d.getTime() - DAY)) || isAbsentDay(key, new Date(d.getTime() + DAY)))
        ) {
          s.absent++;
          s.sandwich++;
        } else {
          s.weeklyOff++;
        }
        break;
      }
      case "HOLIDAY": {
        // হলিডের আগের ও পরের কর্মদিবস দুটোই Absent হলে এই হলিডে Absent গণ্য (বেতন নেই)
        const d = new Date(r.attendanceDate);
        const worked = (r.punchCount || 0) >= 2 || (r.overtimeMinutes || 0) > 0;
        if (
          cfg.HOLIDAY_SANDWICH_ABSENT &&
          !worked &&
          workingDayAbsent(key, d, -1) === true &&
          workingDayAbsent(key, d, +1) === true
        ) {
          s.absent++;
          s.holidaySandwich++;
        } else {
          s.holiday++;
        }
        break;
      }
      case "LEAVE":
        s.leave++;
        if (/\(UNPAID\)/i.test(r.remarks || "")) s.unpaidLeave++;
        break;
      default: break;
    }
    if (isNight && (r.status === "PRESENT" || r.status === "LATE")) s.night++;
    if (r.overtimeMinutes > 0) {
      if (isNight) s.otNightMin += r.overtimeMinutes;
      else s.otDayMin += r.overtimeMinutes;
    }
  }

  return { stats, monthDays };
};

const statsToAuto = (s, monthDays) => {
  const empty = !s;
  const st = s || {
    recorded: 0, present: 0, late: 0, absent: 0, incomplete: 0,
    weeklyOff: 0, holiday: 0, leave: 0, unpaidLeave: 0, night: 0, otDayMin: 0, otNightMin: 0, sandwich: 0, holidaySandwich: 0,
  };
  const missingDays = Math.max(0, monthDays - st.recorded);
  const unpaid = cfg.UNPAID_LEAVE_AS_ABSENT ? st.unpaidLeave : 0;

  return {
    absent: st.absent + missingDays + (cfg.INCOMPLETE_AS_ABSENT ? st.incomplete : 0) + unpaid,
    leave: st.leave - unpaid,
    late: st.late,
    whDays: st.weeklyOff + st.holiday,
    night: st.night,
    otDayHours: round2(st.otDayMin / 60),
    otNightHours: round2(st.otNightMin / 60),
    incompleteDays: st.incomplete,
    sandwichDays: st.sandwich,
    holidaySandwichDays: st.holidaySandwich,
    missingDays,
    noAttendance: empty,
  };
};

// সেকশন স্টাফদের OT নেই (পুরোনো হিসাবে OT থেকে গেলেও পেরোলে ধরা হবে না)
const noOtFor = (emp) =>
  cfg.OT_EXCLUDED_SECTIONS.includes(String(emp?.section || "").trim().toLowerCase());

const salaryOf = (emp) => {
  const primary = Number(emp[cfg.SALARY_FIELD]) || 0;
  if (primary > 0) return primary;
  const other = cfg.SALARY_FIELD === "basicSalary" ? emp.grossSalary : emp.basicSalary;
  return Number(other) || 0;
};

const recompute = (line) => {
  Object.assign(line, computeLine(line));
  return line;
};

// -------- সেকশন-ভিত্তিক গ্রুপিং --------
// পেরোল শিট এখন সেকশন (Employee.section) ধরে সাজানো/গ্রুপ হয়; Department শুধু বেতনের নিয়মে
// (Att. Bonus / OT 20% বাদ) লাগে, গ্রুপিংয়ে নয়। সেকশন ফাঁকা থাকলে "No Section" ধরা হয়।
const NO_SECTION = "No Section";
const sectionName = (l) => String(l.section || "").trim() || NO_SECTION;
// বড়/ছোট হাতের তফাত ও বাড়তি স্পেস উপেক্ষা করে একই সেকশন চেনার চাবি
const sectionKey = (l) => sectionName(l).toLowerCase();

const naturalCompare = (a, b) =>
  String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });

// সাজানোর ক্রম: কনফিগে নাম থাকলে সেই ক্রমে (শিটের মতো), বাকিগুলো নামের ক্রমে, "No Section" সবার শেষে
const sectionRank = (name) => {
  if (name === NO_SECTION) return 2000;
  const i = cfg.DEPARTMENT_ORDER.findIndex((d) => d.toLowerCase() === String(name).trim().toLowerCase());
  return i === -1 ? 1000 : i;
};
const compareSections = (a, b) => {
  const ra = sectionRank(a);
  const rb = sectionRank(b);
  return ra !== rb ? ra - rb : naturalCompare(a, b);
};

// পুরনো পেরোল লাইনে সেকশন স্ন্যাপশট ফাঁকা থাকতে পারে (সেকশন যোগ হওয়ার আগে বানানো, বা কর্মীর সেকশন পরে বসানো)।
// তাই দেখানো/এক্সপোর্টের সময় ফাঁকা লাইনগুলোর সেকশন কর্মীর বর্তমান সেকশন থেকে ভরা হয় (ডাটাবেসে বদলায় না)।
// স্ন্যাপশটে সেকশন থাকলে সেটাই থাকে, ফলে পুরনো পেরোলের ইতিহাস ঠিক থাকে।
const fillMissingSections = async (lines, companyId) => {
  const missing = lines.filter((l) => !String(l.section || "").trim());
  if (!missing.length) return lines;
  const emps = await Employee.find({
    company: companyId,
    _id: { $in: missing.map((l) => l.employee) },
  })
    .select("section")
    .lean();
  const byId = new Map(emps.map((e) => [String(e._id), String(e.section || "").trim()]));
  return lines.map((l) =>
    String(l.section || "").trim() ? l : { ...l, section: byId.get(String(l.employee)) || "" },
  );
};

const sortLines = (lines) =>
  [...lines].sort((a, b) => {
    if (sectionKey(a) !== sectionKey(b)) return compareSections(sectionName(a), sectionName(b));
    return naturalCompare(a.employeeId, b.employeeId);
  });

// -------- Generate / Regenerate (শুধু DRAFT) --------
const generatePayroll = async (month, userId, companyId) => {
  const { end, monthDays } = monthRange(month);

  let run = await PayrollRun.findOne({ month, company: companyId });
  if (run && run.status !== "DRAFT") {
    const err = new Error(`এই মাসের পেরোল ${run.status} অবস্থায় আছে। আগে Reopen করুন।`);
    err.status = 409;
    throw err;
  }
  if (!run) {
    run = await PayrollRun.create({ company: companyId, month, monthDays, generatedBy: userId });
  } else {
    run.monthDays = monthDays;
    run.generatedAt = new Date();
    run.generatedBy = userId;
    await run.save();
  }

  const { stats } = await loadAttendanceStats(month, companyId);
  const loanDeductions = await loadLoanDeductions(month, companyId); // অনুমোদিত Advance/Loan কিস্তি
  const attendedIds = [...stats.keys()];

  const employees = await Employee.find({
    company: companyId,
    isDeleted: { $ne: true },
    joiningDate: { $lt: end },
    $or: [{ employmentStatus: "Active" }, { _id: { $in: attendedIds } }],
  })
    .populate("department", "name")
    .populate("designation", "name")
    .lean();

  const existing = await PayrollLine.find({ company: companyId, run: run._id });
  const existingByEmp = new Map(existing.map((l) => [String(l.employee), l]));
  const eligible = new Set(employees.map((e) => String(e._id)));

  // যারা আর যোগ্য নন এবং হাতে কিছু বদলানো হয়নি, তাদের লাইন বাদ
  const staleIds = existing
    .filter((l) => !eligible.has(String(l.employee)) && l.manualFields.length === 0)
    .map((l) => l._id);
  if (staleIds.length) await PayrollLine.deleteMany({ _id: { $in: staleIds } });

  let created = 0;
  let updated = 0;

  for (const emp of employees) {
    const auto = statsToAuto(stats.get(String(emp._id)), monthDays);
    const snapshot = {
      department: emp.department?.name?.trim() || "Unassigned",
      section: emp.section || "",
      employeeId: emp.employeeId,
      name: emp.name,
      designation: emp.designation?.name || "",
      monthDays,
      incompleteDays: auto.incompleteDays,
      missingDays: auto.missingDays,
      loanDeduction: loanDeductions.get(String(emp._id))?.total || 0,
      loanRefs: loanDeductions.get(String(emp._id))?.refs || [],
    };
    const autoValues = {
      absent: auto.absent, leave: auto.leave, late: auto.late, whDays: auto.whDays,
      night: auto.night,
      otDayHours: noOtFor(emp) ? 0 : auto.otDayHours,
      otNightHours: noOtFor(emp) ? 0 : auto.otNightHours,
      basicSalary: salaryOf(emp),
      method: emp.paymentMethod || "Cash",
      accountNumber: emp.paymentAccount || "",
    };

    const line = existingByEmp.get(String(emp._id));
    if (!line) {
      await PayrollLine.create(recompute({ company: companyId, run: run._id, employee: emp._id, ...snapshot, ...autoValues }));
      created++;
    } else {
      Object.assign(line, snapshot);
      for (const f of AUTO_FIELDS) {
        if (!line.manualFields.includes(f)) line[f] = autoValues[f];
      }
      recompute(line);
      await line.save();
      updated++;
    }
  }

  return { run, created, updated };
};

// -------- একটি লাইন এডিট --------
const updateLine = async (lineId, body, companyId) => {
  const line = await PayrollLine.findOne({ _id: lineId, company: companyId });
  if (!line) {
    const err = new Error("Payroll line not found");
    err.status = 404;
    throw err;
  }
  const run = await PayrollRun.findOne({ _id: line.run, company: companyId });
  if (run.status !== "DRAFT") {
    const err = new Error("Finalized payroll cannot be edited. Reopen first.");
    err.status = 409;
    throw err;
  }

  // Auto মানে ফেরত নিতে চাইলে
  const resetFields = (Array.isArray(body.reset) ? body.reset : []).filter((f) => AUTO_FIELDS.includes(f));
  if (resetFields.length) {
    const emp = await Employee.findById(line.employee).lean();
    const { stats, monthDays } = await loadAttendanceStats(run.month, companyId, [line.employee]);
    const auto = statsToAuto(stats.get(String(line.employee)), monthDays);
    const autoValues = {
      absent: auto.absent, leave: auto.leave, late: auto.late, whDays: auto.whDays,
      night: auto.night,
      otDayHours: noOtFor(emp) ? 0 : auto.otDayHours,
      otNightHours: noOtFor(emp) ? 0 : auto.otNightHours,
      basicSalary: emp ? salaryOf(emp) : line.basicSalary,
      method: emp?.paymentMethod || "Cash",
      accountNumber: emp?.paymentAccount || "",
    };
    for (const f of resetFields) {
      line[f] = autoValues[f];
      line.manualFields = line.manualFields.filter((x) => x !== f);
    }
  }

  for (const f of NUMERIC_FIELDS) {
    if (body[f] === undefined) continue;
    const v = Number(body[f]);
    if (!Number.isFinite(v) || v < 0) {
      const err = new Error(`${f} must be a non-negative number`);
      err.status = 400;
      throw err;
    }
    line[f] = f === "basicSalary" || f.startsWith("prev") || f === "advance" ? v : round2(v);
    if (AUTO_FIELDS.includes(f) && !line.manualFields.includes(f)) line.manualFields.push(f);
  }

  if (body.method !== undefined) {
    if (!cfg.METHODS.includes(body.method)) {
      const err = new Error("Invalid payment method");
      err.status = 400;
      throw err;
    }
    line.method = body.method;
    if (!line.manualFields.includes("method")) line.manualFields.push("method");
  }
  if (body.accountNumber !== undefined) {
    line.accountNumber = String(body.accountNumber).trim();
    if (!line.manualFields.includes("accountNumber")) line.manualFields.push("accountNumber");
  }
  if (body.remarks !== undefined) line.remarks = String(body.remarks).slice(0, 300);

  if (line.absent + line.leave + line.whDays > line.monthDays) {
    const err = new Error("Absent + Leave + WH Days cannot exceed Month Days");
    err.status = 400;
    throw err;
  }

  recompute(line);
  await line.save();
  return line;
};

// -------- সামারি (TOP_SHEET) --------
const SUM_KEYS = [
  "basicSalary", "salaryPayable", "otDayHours", "otNightHours", "otHours",
  "otAmount", "ot20", "attBonus", "nightAllowance",
  "prevAdjAddition", "prevAdjDeduction", "advance", "loanDeduction", "netPayable",
];

const emptyTotals = () => Object.fromEntries(SUM_KEYS.map((k) => [k, 0]));

const buildSummary = (lines) => {
  const bySection = new Map();
  const totals = { ...emptyTotals(), headcount: 0 };

  for (const l of lines) {
    const key = sectionKey(l);
    let d = bySection.get(key);
    if (!d) {
      d = { section: sectionName(l), headcount: 0, ...emptyTotals() };
      bySection.set(key, d);
    }
    d.headcount++;
    totals.headcount++;
    for (const k of SUM_KEYS) {
      d[k] += Number(l[k]) || 0;
      totals[k] += Number(l[k]) || 0;
    }
  }

  const sections = [...bySection.values()].sort((a, b) => compareSections(a.section, b.section));

  const hold = lines.filter((l) => l.method === "Hold");
  const methods = {};
  for (const m of cfg.METHODS) {
    const ls = lines.filter((l) => l.method === m);
    methods[m] = { count: ls.length, amount: ls.reduce((s, l) => s + l.netPayable, 0) };
  }

  return {
    sections,
    totals,
    methods,
    holdAmount: hold.reduce((s, l) => s + l.netPayable, 0),
    warnings: {
      incomplete: lines.filter((l) => l.incompleteDays > 0).length,
      missing: lines.filter((l) => l.missingDays > 0).length,
      noSalary: lines.filter((l) => !(l.basicSalary > 0)).length,
      noAccount: lines.filter((l) => ["Bkash", "Bank"].includes(l.method) && !l.accountNumber).length,
      negativeNet: lines.filter((l) => l.netPayable < 0).length,
    },
  };
};

module.exports = {
  generatePayroll,
  updateLine,
  buildSummary,
  sortLines,
  fillMissingSections,
  sectionName,
  sectionKey,
  NO_SECTION,
  monthRange,
  AUTO_FIELDS,
  INPUT_FIELDS,
};
