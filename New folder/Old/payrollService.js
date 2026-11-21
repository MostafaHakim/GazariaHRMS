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
  const filter = { company: companyId, attendanceDate: { $gte: start, $lt: end } };
  if (employeeIds) filter.employee = { $in: employeeIds };

  const [records, shifts] = await Promise.all([
    DailyAttendance.find(filter)
      .select("employee status shift shiftCode overtimeMinutes remarks")
      .lean(),
    Shift.find({ company: companyId }).select("_id code isNightShift").lean(),
  ]);

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
        night: 0, otDayMin: 0, otNightMin: 0,
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
      case "WEEKLY_OFF": s.weeklyOff++; break;
      case "HOLIDAY": s.holiday++; break;
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
    weeklyOff: 0, holiday: 0, leave: 0, unpaidLeave: 0, night: 0, otDayMin: 0, otNightMin: 0,
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
    missingDays,
    noAttendance: empty,
  };
};

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

// ডিপার্টমেন্ট সাজানোর ক্রম (শিটের মতো)
const deptRank = (name) => {
  const i = cfg.DEPARTMENT_ORDER.findIndex(
    (d) => d.toLowerCase() === String(name || "").trim().toLowerCase(),
  );
  return i === -1 ? 1000 : i;
};

const sortLines = (lines) =>
  [...lines].sort((a, b) => {
    const ra = deptRank(a.department);
    const rb = deptRank(b.department);
    if (ra !== rb) return ra - rb;
    if (ra === 1000 && a.department !== b.department) {
      return String(a.department).localeCompare(String(b.department));
    }
    return String(a.employeeId).localeCompare(String(b.employeeId), undefined, { numeric: true });
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
      night: auto.night, otDayHours: auto.otDayHours, otNightHours: auto.otNightHours,
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
      night: auto.night, otDayHours: auto.otDayHours, otNightHours: auto.otNightHours,
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
  const byDept = new Map();
  const totals = { ...emptyTotals(), headcount: 0 };

  for (const l of lines) {
    let d = byDept.get(l.department);
    if (!d) {
      d = { department: l.department, headcount: 0, ...emptyTotals() };
      byDept.set(l.department, d);
    }
    d.headcount++;
    totals.headcount++;
    for (const k of SUM_KEYS) {
      d[k] += Number(l[k]) || 0;
      totals[k] += Number(l[k]) || 0;
    }
  }

  const departments = [...byDept.values()].sort((a, b) => {
    const ra = deptRank(a.department);
    const rb = deptRank(b.department);
    return ra !== rb ? ra - rb : String(a.department).localeCompare(String(b.department));
  });

  const hold = lines.filter((l) => l.method === "Hold");
  const methods = {};
  for (const m of cfg.METHODS) {
    const ls = lines.filter((l) => l.method === m);
    methods[m] = { count: ls.length, amount: ls.reduce((s, l) => s + l.netPayable, 0) };
  }

  return {
    departments,
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
  monthRange,
  AUTO_FIELDS,
  INPUT_FIELDS,
};
