const {
  calculateDailyAttendance,
} = require("../services/attendanceCalculationService");

const DailyAttendance = require("../models/DailyAttendance");
const Shift = require("../models/Shift");
const Employee = require("../models/Employee");

const MAX_RANGE_DAYS = 93;
const DAY_MS = 24 * 60 * 60 * 1000;
const isDateString = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const dateStr = (d) => d.toISOString().slice(0, 10);

/**
 * POST /api/daily-attendance/calculate
 * Body: { date } অথবা { fromDate, toDate }  (সর্বোচ্চ ৯৩ দিন)
 * Range-এ কোনো দিনে সমস্যা (যেমন Roster নেই) হলে সেই দিন বাদ দিয়ে বাকিগুলো চলে।
 */
const runDailyCalculation = async (req, res, next) => {
  try {
    const { date, fromDate, toDate } = req.body;

    // ---- Date range ----
    if (fromDate || toDate) {
      if (!isDateString(fromDate) || !isDateString(toDate)) {
        return res.status(400).json({
          success: false,
          message: "fromDate ও toDate দিন (YYYY-MM-DD)",
        });
      }

      const from = new Date(`${fromDate}T00:00:00.000Z`);
      const to = new Date(`${toDate}T00:00:00.000Z`);

      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        return res.status(400).json({ success: false, message: "সঠিক তারিখ দিন" });
      }
      if (to < from) {
        return res.status(400).json({
          success: false,
          message: "শেষ তারিখ শুরুর তারিখের আগে হতে পারে না",
        });
      }

      const totalDays = Math.round((to - from) / DAY_MS) + 1;
      if (totalDays > MAX_RANGE_DAYS) {
        return res.status(400).json({
          success: false,
          message: `একবারে সর্বোচ্চ ${MAX_RANGE_DAYS} দিন হিসাব করা যায়`,
        });
      }

      const results = [];
      const totals = {
        processed: 0, present: 0, late: 0, absent: 0, incomplete: 0,
        weeklyOff: 0, holiday: 0, leave: 0, skipped: 0,
      };

      for (let d = new Date(from); d <= to; d = new Date(d.getTime() + DAY_MS)) {
        const ds = dateStr(d);
        try {
          const r = await calculateDailyAttendance(ds, { companyId: req.companyId });
          results.push({ date: ds, success: true, ...r });
          for (const key of Object.keys(totals)) totals[key] += r[key] || 0;
        } catch (err) {
          results.push({ date: ds, success: false, error: err.message });
        }
      }

      const failedDays = results.filter((r) => !r.success).length;

      return res.status(200).json({
        success: true,
        message:
          failedDays === 0
            ? `${fromDate} থেকে ${toDate} (${totalDays} দিন) হিসাব সম্পন্ন`
            : `${totalDays - failedDays} দিন হিসাব হয়েছে, ${failedDays} দিন হয়নি`,
        data: {
          range: true,
          fromDate,
          toDate,
          days: totalDays,
          successDays: totalDays - failedDays,
          failedDays,
          ...totals,
          results,
        },
      });
    }

    // ---- Single date ----
    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required. Use YYYY-MM-DD.",
      });
    }

    const result = await calculateDailyAttendance(date, { companyId: req.companyId });

    res.status(200).json({
      success: true,
      message: "Daily attendance calculated successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const getDailyAttendance = async (req, res, next) => {
  try {
    const { date, from, to, employeeId, status, section, page = 1, limit = 50 } = req.query;

    const filter = { company: req.companyId };

    // তারিখের Range (from..to) — একসাথে একাধিক দিনের রেকর্ড দেখার জন্য
    if (isDateString(from) && isDateString(to)) {
      const start = new Date(`${from}T00:00:00.000Z`);
      const end = new Date(`${to}T00:00:00.000Z`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
        return res.status(400).json({ success: false, message: "সঠিক from/to তারিখ দিন" });
      }
      end.setUTCDate(end.getUTCDate() + 1);
      filter.attendanceDate = { $gte: start, $lt: end };
    } else if (date) {
      const [year, month, day] = date.split("-").map(Number);
      const start = new Date(Date.UTC(year, month - 1, day));
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);

      filter.attendanceDate = {
        $gte: start,
        $lt: end,
      };
    }

    if (employeeId) {
      filter.employeeId = employeeId;
    }

    // Section ফিল্টার (Employee.section অনুযায়ী)
    if (section) {
      const sectionFilter =
        section === "__NONE__"
          ? { $or: [{ section: "" }, { section: null }] }
          : { section };
      const ids = await Employee.find({
        company: req.companyId,
        isDeleted: { $ne: true },
        ...sectionFilter,
      }).distinct("_id");
      filter.employee = { $in: ids };
    }

    // NIGHT = রাতের শিফট, এখনো পাঞ্চ নেই, শিফট শেষ হয়নি → Absent নয়
    const nightShiftIds = await Shift.find({ company: req.companyId, isNightShift: true }).distinct("_id");
    const nightCond = {
      status: "ABSENT",
      punchCount: 0,
      shift: { $in: nightShiftIds },
      shiftEnd: { $gt: new Date() },
    };

    // Summary: status ফিল্টার ছাড়া (তারিখ + section অনুযায়ী পুরো দিনের হিসাব)
    const [grouped, nightCount, incompleteLate] = await Promise.all([
      DailyAttendance.aggregate([
        { $match: filter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      DailyAttendance.countDocuments({ ...filter, ...nightCond }),
      // একটি পাঞ্চ থাকায় INCOMPLETE, কিন্তু দেরিতে এসেছে (১০ মি. এর বেশি)
      DailyAttendance.countDocuments({
        ...filter,
        status: "INCOMPLETE",
        lateMinutes: { $gt: 0 },
      }),
    ]);
    const byStatus = Object.fromEntries(grouped.map((g) => [g._id, g.count]));
    const summary = {
      total: grouped.reduce((n, g) => n + g.count, 0),
      present: byStatus.PRESENT || 0,
      late: byStatus.LATE || 0,
      incompleteLate,
      absent: Math.max(0, (byStatus.ABSENT || 0) - nightCount),
      night: nightCount,
      incomplete: byStatus.INCOMPLETE || 0,
      weeklyOff: byStatus.WEEKLY_OFF || 0,
      holiday: byStatus.HOLIDAY || 0,
      leave: byStatus.LEAVE || 0,
    };

    // Status ফিল্টার
    const wanted = status ? status.toUpperCase() : "";
    if (wanted === "NIGHT") {
      Object.assign(filter, nightCond);
    } else if (wanted === "ABSENT") {
      filter.status = "ABSENT";
      filter.$nor = [nightCond];
    } else if (wanted) {
      filter.status = wanted;
    }

    const pageNumber = Math.max(1, Number(page));
    const limitNumber = Math.min(200, Math.max(1, Number(limit)));

    const [rawRecords, total, sections] = await Promise.all([
      DailyAttendance.find(filter)
        .populate("shift", "name code startTime endTime isNightShift")
        .sort({ attendanceDate: 1, employeeId: 1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
        .lean(),

      DailyAttendance.countDocuments(filter),

      Employee.distinct("section", { company: req.companyId, isDeleted: { $ne: true } }),
    ]);

    const now = new Date();
    const records = rawRecords.map((r) => ({
      ...r,
      displayStatus:
        r.status === "ABSENT" &&
        !r.punchCount &&
        r.shift?.isNightShift &&
        r.shiftEnd &&
        new Date(r.shiftEnd) > now
          ? "NIGHT"
          : r.status,
    }));

    res.status(200).json({
      success: true,
      data: records,
      summary,
      sections: sections
        .map((s) => String(s || "").trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    next(error);
  }
};

const getMonthlyAttendance = async (req, res, next) => {
  try {
    const { month } = req.query;

    if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return res.status(400).json({
        success: false,
        message: "Valid month is required. Use YYYY-MM format.",
      });
    }

    const [year, monthNumber] = month.split("-").map(Number);

    const startDate = new Date(Date.UTC(year, monthNumber - 1, 1));

    const endDate = new Date(Date.UTC(year, monthNumber, 1));

    const records = await DailyAttendance.aggregate([
      {
        $match: {
          company: req.companyId,
          attendanceDate: {
            $gte: startDate,
            $lt: endDate,
          },
        },
      },
      {
        $group: {
          _id: "$employee",

          employeeId: { $first: "$employeeId" },
          employeeName: { $first: "$employeeName" },

          present: {
            $sum: {
              $cond: [{ $eq: ["$status", "PRESENT"] }, 1, 0],
            },
          },

          late: {
            $sum: {
              $cond: [{ $eq: ["$status", "LATE"] }, 1, 0],
            },
          },

          absent: {
            $sum: {
              $cond: [{ $eq: ["$status", "ABSENT"] }, 1, 0],
            },
          },

          incomplete: {
            $sum: {
              $cond: [{ $eq: ["$status", "INCOMPLETE"] }, 1, 0],
            },
          },

          weeklyOff: {
            $sum: {
              $cond: [{ $eq: ["$status", "WEEKLY_OFF"] }, 1, 0],
            },
          },

          holiday: {
            $sum: {
              $cond: [{ $eq: ["$status", "HOLIDAY"] }, 1, 0],
            },
          },

          leave: {
            $sum: {
              $cond: [{ $eq: ["$status", "LEAVE"] }, 1, 0],
            },
          },

          workingMinutes: { $sum: "$netWorkedMinutes" },
          overtimeMinutes: { $sum: "$overtimeMinutes" },
          lateMinutes: { $sum: "$lateMinutes" },
          earlyLeaveMinutes: { $sum: "$earlyLeaveMinutes" },
          totalPunches: { $sum: "$punchCount" },
        },
      },
      {
        $project: {
          _id: 0,
          employeeId: 1,
          employeeName: 1,

          present: 1,
          late: 1,
          absent: 1,
          incomplete: 1,
          weeklyOff: 1,
          holiday: 1,
          leave: 1,

          payableDays: {
            $add: ["$present", "$late"],
          },

          workingMinutes: 1,
          overtimeMinutes: 1,
          lateMinutes: 1,
          earlyLeaveMinutes: 1,
          totalPunches: 1,
        },
      },
      {
        $sort: {
          employeeId: 1,
        },
      },
    ]);

    const summary = records.reduce(
      (total, record) => {
        total.totalEmployees++;
        total.present += record.present;
        total.late += record.late;
        total.absent += record.absent;
        total.incomplete += record.incomplete;
        total.payableDays += record.payableDays;
        total.workingMinutes += record.workingMinutes;
        total.overtimeMinutes += record.overtimeMinutes;

        return total;
      },
      {
        totalEmployees: 0,
        present: 0,
        late: 0,
        absent: 0,
        incomplete: 0,
        payableDays: 0,
        workingMinutes: 0,
        overtimeMinutes: 0,
      },
    );

    res.status(200).json({
      success: true,
      month,
      summary,
      data: records,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Manual edit of a daily attendance record (missing punch fix etc.)
 * Body: firstIn, lastOut, status, remarks, lateMinutes, earlyLeaveMinutes,
 *        overtimeMinutes, workedMinutes, netWorkedMinutes (optional)
 * Times can be ISO string or "HH:mm" (BD local) with attendanceDate used as day.
 */
const manualUpdateAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const record = await DailyAttendance.findOne({ _id: id, company: req.companyId });
    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    const parseTimeOnDate = (value, baseDate) => {
      if (!value) return null;
      if (typeof value === "string" && /^\d{1,2}:\d{2}$/.test(value.trim())) {
        const [h, m] = value.trim().split(":").map(Number);
        // BD local → UTC (BD = UTC+6)
        const d = new Date(baseDate);
        d.setUTCHours(h - 6, m, 0, 0);
        return d;
      }
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    const base = record.attendanceDate;

    if (body.firstIn !== undefined) {
      record.firstIn = parseTimeOnDate(body.firstIn, base);
    }
    if (body.lastOut !== undefined) {
      record.lastOut = parseTimeOnDate(body.lastOut, base);
    }

    // Auto-calc worked minutes if both times present and not overridden
    if (record.firstIn && record.lastOut) {
      const worked = Math.max(
        0,
        Math.floor((record.lastOut - record.firstIn) / 60000),
      );
      if (body.workedMinutes === undefined) {
        record.workedMinutes = worked;
        record.netWorkedMinutes = Math.max(
          0,
          worked - (record.breakMinutes || 0),
        );
      }
      if (body.punchCount === undefined) {
        record.punchCount = Math.max(2, record.punchCount || 2);
      }
    }

    if (body.workedMinutes !== undefined)
      record.workedMinutes = Number(body.workedMinutes) || 0;
    if (body.netWorkedMinutes !== undefined)
      record.netWorkedMinutes = Number(body.netWorkedMinutes) || 0;
    if (body.lateMinutes !== undefined)
      record.lateMinutes = Number(body.lateMinutes) || 0;
    if (body.earlyLeaveMinutes !== undefined)
      record.earlyLeaveMinutes = Number(body.earlyLeaveMinutes) || 0;
    if (body.overtimeMinutes !== undefined)
      record.overtimeMinutes = Number(body.overtimeMinutes) || 0;
    if (body.punchCount !== undefined)
      record.punchCount = Number(body.punchCount) || 0;

    if (body.status) {
      const allowed = [
        "PRESENT",
        "LATE",
        "ABSENT",
        "INCOMPLETE",
        "WEEKLY_OFF",
        "HOLIDAY",
        "LEAVE",
      ];
      if (allowed.includes(String(body.status).toUpperCase())) {
        record.status = String(body.status).toUpperCase();
      }
    }

    if (body.remarks !== undefined) {
      record.remarks = body.remarks;
    }

    record.isManuallyEdited = true;
    record.calculatedAt = new Date();

    await record.save();

    const populated = await DailyAttendance.findOne({ _id: record._id, company: req.companyId }).populate(
      "shift",
      "name code startTime endTime",
    );

    res.status(200).json({
      success: true,
      message: "Attendance updated manually. Auto-calculate will not overwrite this.",
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Employee Job Card — full month day-by-day in/out report
 * Query: employeeId (code) or employee (mongo id), month=YYYY-MM
 */
const getEmployeeJobCard = async (req, res, next) => {
  try {
    const { employeeId, employee, month } = req.query;

    if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return res.status(400).json({
        success: false,
        message: "Valid month required (YYYY-MM)",
      });
    }

    if (!employeeId && !employee) {
      return res.status(400).json({
        success: false,
        message: "employeeId or employee is required",
      });
    }

    const [year, monthNumber] = month.split("-").map(Number);
    const startDate = new Date(Date.UTC(year, monthNumber - 1, 1));
    const endDate = new Date(Date.UTC(year, monthNumber, 1));

    const filter = {
      company: req.companyId,
      attendanceDate: { $gte: startDate, $lt: endDate },
    };
    if (employeeId) filter.employeeId = String(employeeId).trim().toUpperCase();
    if (employee) filter.employee = employee;

    const records = await DailyAttendance.find(filter)
      .populate("shift", "name code startTime endTime")
      .sort({ attendanceDate: 1 })
      .lean();

    if (!records.length) {
      return res.status(200).json({
        success: true,
        month,
        employee: null,
        days: [],
        summary: {
          present: 0,
          late: 0,
          absent: 0,
          incomplete: 0,
          weeklyOff: 0,
          holiday: 0,
          leave: 0,
          payableDays: 0,
          totalWorkedMinutes: 0,
          totalOvertimeMinutes: 0,
          totalLateMinutes: 0,
        },
      });
    }

    const summary = {
      present: 0,
      late: 0,
      absent: 0,
      incomplete: 0,
      weeklyOff: 0,
      holiday: 0,
      leave: 0,
      payableDays: 0,
      totalWorkedMinutes: 0,
      totalOvertimeMinutes: 0,
      totalLateMinutes: 0,
      totalEarlyLeaveMinutes: 0,
    };

    for (const r of records) {
      if (r.status === "PRESENT") summary.present++;
      else if (r.status === "LATE") summary.late++;
      else if (r.status === "ABSENT") summary.absent++;
      else if (r.status === "INCOMPLETE") summary.incomplete++;
      else if (r.status === "WEEKLY_OFF") summary.weeklyOff++;
      else if (r.status === "HOLIDAY") summary.holiday++;
      else if (r.status === "LEAVE") summary.leave++;

      if (r.status === "PRESENT" || r.status === "LATE") summary.payableDays++;
      summary.totalWorkedMinutes += r.netWorkedMinutes || 0;
      summary.totalOvertimeMinutes += r.overtimeMinutes || 0;
      summary.totalLateMinutes += r.lateMinutes || 0;
      summary.totalEarlyLeaveMinutes += r.earlyLeaveMinutes || 0;
    }

    res.status(200).json({
      success: true,
      month,
      employee: {
        employeeId: records[0].employeeId,
        name: records[0].employeeName,
        _id: records[0].employee,
      },
      days: records,
      summary,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Department-wise daily attendance sheet
 * Query: date=YYYY-MM-DD, department (optional mongo id)
 */
const getDepartmentDailySheet = async (req, res, next) => {
  try {
    const { date, department } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: "date required (YYYY-MM-DD)",
      });
    }

    const [y, m, d] = date.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, d));
    const end = new Date(Date.UTC(y, m - 1, d + 1));

    const filter = {
      company: req.companyId,
      attendanceDate: { $gte: start, $lt: end },
    };

    let records = await DailyAttendance.find(filter)
      .populate({
        path: "employee",
        select: "employeeId name department section employmentStatus",
        populate: { path: "department", select: "name code" },
      })
      .populate("shift", "name code startTime endTime")
      .sort({ employeeId: 1 })
      .lean();

    if (department) {
      records = records.filter(
        (r) =>
          r.employee?.department &&
          (r.employee.department._id || r.employee.department).toString() ===
            department,
      );
    }

    // Group by department name
    const groups = {};
    for (const r of records) {
      const deptName =
        r.employee?.department?.name ||
        (typeof r.employee?.department === "string"
          ? r.employee.department
          : null) ||
        "Unknown";
      if (!groups[deptName]) groups[deptName] = [];
      groups[deptName].push(r);
    }

    const summary = {
      total: records.length,
      present: records.filter((r) => r.status === "PRESENT").length,
      late: records.filter((r) => r.status === "LATE").length,
      absent: records.filter((r) => r.status === "ABSENT").length,
      incomplete: records.filter((r) => r.status === "INCOMPLETE").length,
      weeklyOff: records.filter((r) => r.status === "WEEKLY_OFF").length,
      holiday: records.filter((r) => r.status === "HOLIDAY").length,
    };

    res.status(200).json({
      success: true,
      date,
      summary,
      departments: Object.keys(groups)
        .sort()
        .map((name) => ({
          name,
          count: groups[name].length,
          records: groups[name],
        })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * OT / Late summary for a month
 * Query: month=YYYY-MM, type=ot|late|both
 */
const getOtLateReport = async (req, res, next) => {
  try {
    const { month, type = "both" } = req.query;
    if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return res.status(400).json({
        success: false,
        message: "month required (YYYY-MM)",
      });
    }

    const [year, monthNumber] = month.split("-").map(Number);
    const startDate = new Date(Date.UTC(year, monthNumber - 1, 1));
    const endDate = new Date(Date.UTC(year, monthNumber, 1));

    const records = await DailyAttendance.aggregate([
      {
        $match: {
          company: req.companyId,
          attendanceDate: { $gte: startDate, $lt: endDate },
        },
      },
      {
        $group: {
          _id: "$employee",
          employeeId: { $first: "$employeeId" },
          employeeName: { $first: "$employeeName" },
          totalOvertimeMinutes: { $sum: "$overtimeMinutes" },
          totalLateMinutes: { $sum: "$lateMinutes" },
          lateDays: {
            $sum: { $cond: [{ $gt: ["$lateMinutes", 0] }, 1, 0] },
          },
          otDays: {
            $sum: { $cond: [{ $gt: ["$overtimeMinutes", 0] }, 1, 0] },
          },
          presentDays: {
            $sum: {
              $cond: [
                { $in: ["$status", ["PRESENT", "LATE"]] },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          employee: "$_id",
          employeeId: 1,
          employeeName: 1,
          totalOvertimeMinutes: 1,
          totalLateMinutes: 1,
          lateDays: 1,
          otDays: 1,
          presentDays: 1,
        },
      },
      { $sort: { employeeId: 1 } },
    ]);

    let filtered = records;
    if (type === "ot") {
      filtered = records.filter((r) => r.totalOvertimeMinutes > 0);
      filtered.sort((a, b) => b.totalOvertimeMinutes - a.totalOvertimeMinutes);
    } else if (type === "late") {
      filtered = records.filter((r) => r.totalLateMinutes > 0);
      filtered.sort((a, b) => b.totalLateMinutes - a.totalLateMinutes);
    }

    const totals = filtered.reduce(
      (acc, r) => {
        acc.overtimeMinutes += r.totalOvertimeMinutes;
        acc.lateMinutes += r.totalLateMinutes;
        acc.employees += 1;
        return acc;
      },
      { overtimeMinutes: 0, lateMinutes: 0, employees: 0 },
    );

    res.status(200).json({
      success: true,
      month,
      type,
      totals,
      data: filtered,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  runDailyCalculation,
  getDailyAttendance,
  getMonthlyAttendance,
  manualUpdateAttendance,
  getEmployeeJobCard,
  getDepartmentDailySheet,
  getOtLateReport,
};
