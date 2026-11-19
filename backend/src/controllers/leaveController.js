const Leave = require("../models/Leave");
const Employee = require("../models/Employee");
const { calculateDailyAttendance } = require("../services/attendanceCalculationService");

const DAY_MS = 24 * 60 * 60 * 1000;

const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const toDateString = (d) => d.toISOString().slice(0, 10);

const bdTodayString = () =>
  new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);

// শুক্রবার (সাপ্তাহিক ছুটি) বাদে দিন গণনা
const countLeaveDays = (from, to) => {
  let days = 0;
  for (let d = new Date(from); d <= to; d = new Date(d.getTime() + DAY_MS)) {
    if (d.getUTCDay() !== 5) days++;
  }
  return days;
};

// Leave বদলালে (আজ পর্যন্ত) Attendance আবার হিসাব হবে — শুধু ঐ কর্মীর জন্য
const recalcForLeave = async (leave) => {
  const employee = await Employee.findOne({ _id: leave.employee, company: leave.company }).select("company").lean();
  if (!employee) return [];
  const today = bdTodayString();
  const results = [];
  for (
    let d = new Date(leave.fromDate);
    d <= leave.toDate && toDateString(d) <= today;
    d = new Date(d.getTime() + DAY_MS)
  ) {
    const dateStr = toDateString(d);
    try {
      await calculateDailyAttendance(dateStr, { employeeIds: [leave.employee], companyId: employee.company });
      results.push({ date: dateStr, success: true });
    } catch (err) {
      // Roster না থাকলে ঐ দিনের Attendance পরে Generate হলে Leave নিজে থেকেই ধরা পড়বে
      results.push({ date: dateStr, success: false, error: err.message });
    }
  }
  return results;
};

// GET /api/leaves
exports.getLeaves = async (req, res, next) => {
  try {
    const { status, leaveType, employeeId, section, month, date } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

    const filter = { company: req.companyId };
    if (status) filter.status = status.toUpperCase();
    if (leaveType) filter.leaveType = leaveType.toUpperCase();

    if (employeeId) {
      filter.$or = [
        { employeeId: { $regex: employeeId, $options: "i" } },
        { employeeName: { $regex: employeeId, $options: "i" } },
      ];
    }

    if (section) {
      const sectionFilter =
        section === "__NONE__"
          ? { $or: [{ section: "" }, { section: null }] }
          : { section };
      filter.employee = {
        $in: await Employee.find({ company: req.companyId, isDeleted: { $ne: true }, ...sectionFilter }).distinct("_id"),
      };
    }

    // একটি নির্দিষ্ট দিনে যারা ছুটিতে
    if (date) {
      const d = parseDate(date);
      if (!d) return res.status(400).json({ success: false, message: "সঠিক date দিন (YYYY-MM-DD)" });
      filter.fromDate = { $lte: d };
      filter.toDate = { $gte: d };
    } else if (month) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        return res.status(400).json({ success: false, message: "month YYYY-MM ফরম্যাটে দিন" });
      }
      const [y, m] = month.split("-").map(Number);
      const start = new Date(Date.UTC(y, m - 1, 1));
      const end = new Date(Date.UTC(y, m, 0));
      filter.fromDate = { $lte: end };
      filter.toDate = { $gte: start };
    }

    const [leaves, total, grouped] = await Promise.all([
      Leave.find(filter)
        .populate("employee", "employeeId name section department")
        .sort({ fromDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Leave.countDocuments(filter),
      Leave.aggregate([
        { $match: filter },
        { $group: { _id: "$status", count: { $sum: 1 }, days: { $sum: "$totalDays" } } },
      ]),
    ]);

    const byStatus = Object.fromEntries(grouped.map((g) => [g._id, g]));

    res.status(200).json({
      success: true,
      data: leaves,
      summary: {
        total,
        pending: byStatus.PENDING?.count || 0,
        approved: byStatus.APPROVED?.count || 0,
        rejected: byStatus.REJECTED?.count || 0,
        approvedDays: byStatus.APPROVED?.days || 0,
      },
      leaveTypes: Leave.LEAVE_TYPES,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/leaves
exports.createLeave = async (req, res, next) => {
  try {
    const { employee: empRef, leaveType = "CASUAL", reason = "" } = req.body;
    const fromDate = parseDate(req.body.fromDate);
    const toDate = parseDate(req.body.toDate || req.body.fromDate);

    if (!empRef) return res.status(400).json({ success: false, message: "কর্মী নির্বাচন করুন" });
    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: "সঠিক শুরু ও শেষ তারিখ দিন" });
    }
    if (toDate < fromDate) {
      return res.status(400).json({ success: false, message: "শেষ তারিখ শুরুর তারিখের আগে হতে পারে না" });
    }
    if (!Leave.LEAVE_TYPES.includes(String(leaveType).toUpperCase())) {
      return res.status(400).json({ success: false, message: "সঠিক ছুটির ধরন দিন" });
    }

    const employee = await Employee.findOne({
      _id: empRef,
      company: req.companyId,
      isDeleted: { $ne: true },
    });
    if (!employee) return res.status(404).json({ success: false, message: "কর্মী পাওয়া যায়নি" });

    const totalDays = countLeaveDays(fromDate, toDate);
    if (totalDays < 1) {
      return res.status(400).json({
        success: false,
        message: "নির্বাচিত তারিখগুলো শুধু শুক্রবার (সাপ্তাহিক ছুটি) — ছুটির প্রয়োজন নেই",
      });
    }

    const overlap = await Leave.findOne({
      company: req.companyId,
      employee: employee._id,
      status: { $in: ["PENDING", "APPROVED"] },
      fromDate: { $lte: toDate },
      toDate: { $gte: fromDate },
    }).lean();
    if (overlap) {
      return res.status(409).json({
        success: false,
        message: `এই কর্মীর ${toDateString(overlap.fromDate)} থেকে ${toDateString(overlap.toDate)} পর্যন্ত আগে থেকেই ছুটি আছে`,
      });
    }

    const status = String(req.body.status || "APPROVED").toUpperCase();
    const leave = await Leave.create({
      company: req.companyId,
      employee: employee._id,
      employeeId: employee.employeeId,
      employeeName: employee.name,
      leaveType: String(leaveType).toUpperCase(),
      fromDate,
      toDate,
      totalDays,
      reason,
      status: Leave.LEAVE_STATUS.includes(status) ? status : "APPROVED",
      decidedAt: status === "APPROVED" ? new Date() : null,
    });

    const recalculated = leave.status === "APPROVED" ? await recalcForLeave(leave) : [];

    res.status(201).json({
      success: true,
      message: "ছুটি সংরক্ষণ হয়েছে",
      data: leave,
      recalculated,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/leaves/:id/status   body: { status, decisionNote }
exports.updateLeaveStatus = async (req, res, next) => {
  try {
    const status = String(req.body.status || "").toUpperCase();
    if (!Leave.LEAVE_STATUS.includes(status)) {
      return res.status(400).json({ success: false, message: "সঠিক status দিন" });
    }

    const leave = await Leave.findOne({ _id: req.params.id, company: req.companyId });
    if (!leave) return res.status(404).json({ success: false, message: "Leave পাওয়া যায়নি" });

    leave.status = status;
    leave.decisionNote = req.body.decisionNote || "";
    leave.decidedAt = new Date();
    await leave.save();

    const recalculated = await recalcForLeave(leave);

    res.status(200).json({
      success: true,
      message: "Leave status আপডেট হয়েছে",
      data: leave,
      recalculated,
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/leaves/:id  (মুছে ফেলা)
exports.deleteLeave = async (req, res, next) => {
  try {
    const leave = await Leave.findOne({ _id: req.params.id, company: req.companyId });
    if (!leave) return res.status(404).json({ success: false, message: "Leave পাওয়া যায়নি" });

    const wasApproved = leave.status === "APPROVED";
    await leave.deleteOne();

    const recalculated = wasApproved ? await recalcForLeave(leave) : [];

    res.status(200).json({ success: true, message: "Leave মুছে ফেলা হয়েছে", recalculated });
  } catch (error) {
    next(error);
  }
};
