const Employee = require("../models/Employee");
const Shift = require("../models/Shift");
const WeeklyRoster = require("../models/WeeklyRoster");
const RosterAssignment = require("../models/RosterAssignment");
const {
  parseDate,
  getSaturday,
  resolveShiftId,
  generateRange,
} = require("../services/rosterService");

const { calculateDailyAttendance } = require("../services/attendanceCalculationService");

const POPULATE = "name code startTime endTime";
const OVERRIDE_POPULATE = "name code startTime endTime isNightShift";

const populateRoster = (query) =>
  query
    .populate("entries.shift", POPULATE)
    .populate("entries.dayOverrides.shift", OVERRIDE_POPULATE);

const toDateString = (d) => d.toISOString().slice(0, 10);
const bdTodayString = () =>
  new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);

// পরিবর্তিত তারিখগুলোর (আজ পর্যন্ত) Attendance শুধু ঐ কর্মীর জন্য আবার হিসাব
const recalcDates = async (dates, employeeObjectId, companyId) => {
  const today = bdTodayString();
  const out = [];
  for (const dateStr of dates) {
    if (dateStr > today) continue;
    try {
      await calculateDailyAttendance(dateStr, { employeeIds: [employeeObjectId], companyId });
      out.push({ date: dateStr, success: true });
    } catch (err) {
      out.push({ date: dateStr, success: false, error: err.message });
    }
  }
  return out;
};

// GET: সব Roster দেখা
exports.getWeeklyRosters = async (req, res) => {
  try {
    const { weekStartDate } = req.query;
    const filter = { company: req.companyId };

    if (weekStartDate) {
      const date = parseDate(weekStartDate);
      if (!date) return res.status(400).json({ success: false, message: "সঠিক weekStartDate দিন" });
      filter.weekStartDate = getSaturday(date);
    }

    const rosters = await populateRoster(WeeklyRoster.find(filter)).sort({ weekStartDate: -1 });

    return res.status(200).json({ success: true, count: rosters.length, data: rosters });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST: এক সপ্তাহের Roster Generate (Roster Plan প্যাটার্ন থেকে)
// পুরো বছরের জন্য: POST /api/roster-plans/generate
exports.generateWeeklyRoster = async (req, res) => {
  try {
    const selectedDate = parseDate(req.body.weekStartDate);
    if (!selectedDate) return res.status(400).json({ success: false, message: "সঠিক weekStartDate দিন" });

    const startDate = getSaturday(selectedDate);
    const summary = await generateRange({ from: startDate, to: startDate, companyId: req.companyId });

    const roster = await populateRoster(WeeklyRoster.findOne({ company: req.companyId, weekStartDate: startDate }));
    if (!roster) {
      return res.status(400).json({
        success: false,
        message: "কোনো কর্মীর Roster Plan সেট নেই। আগে Roster Plan পেজে প্যাটার্ন দিন।",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        summary.unassigned > 0
          ? `Roster Generate হয়েছে, কিন্তু ${summary.unassigned} জনের প্যাটার্ন সেট নেই`
          : "Weekly Roster সফলভাবে Generate হয়েছে",
      summary,
      data: roster,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT: নির্দিষ্ট Employee-এর Shift এই সপ্তাহের জন্য Manual Change (Rotation অক্ষত থাকে)
exports.updateRosterEmployeeShift = async (req, res) => {
  try {
    const { rosterId, employeeId } = req.params;
    const { shiftCode, remarks } = req.body;

    if (!shiftCode) return res.status(400).json({ success: false, message: "shiftCode আবশ্যক" });

    const roster = await WeeklyRoster.findOne({ _id: rosterId, company: req.companyId });
    if (!roster) return res.status(404).json({ success: false, message: "Roster পাওয়া যায়নি" });

    const employee = await Employee.findOne({ _id: employeeId, company: req.companyId });
    if (!employee || employee.isDeleted) {
      return res.status(404).json({ success: false, message: "Employee পাওয়া যায়নি" });
    }

    const shift = await Shift.findOne({ company: req.companyId, code: shiftCode.toUpperCase(), isActive: true });
    if (!shift) return res.status(404).json({ success: false, message: "সঠিক Active Shift পাওয়া যায়নি" });

    const entry = roster.entries.find((item) => item.employee.toString() === employee._id.toString());
    if (!entry) return res.status(404).json({ success: false, message: "এই সপ্তাহের Roster-এ Employee নেই" });

    entry.shift = shift._id;
    entry.source = "MANUAL";
    entry.remarks = remarks || "";
    entry.dayOverrides = []; // পুরো সপ্তাহের শিফট বদলালে আলাদা দিনের বদল মুছে যায়
    await roster.save();

    const updatedRoster = await populateRoster(WeeklyRoster.findOne({ _id: roster._id, company: req.companyId }));
    return res.status(200).json({ success: true, message: "এই সপ্তাহের জন্য Shift পরিবর্তন হয়েছে", data: updatedRoster });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


// PUT: সপ্তাহের মাঝখান থেকে শিফট বদল (যেমন মঙ্গলবার থেকে রাতের শিফট)
// Body: { fromDate: "YYYY-MM-DD", toDate?: "YYYY-MM-DD" (ডিফল্ট: সপ্তাহের শেষ), shiftCode, remarks }
// Published Roster-এও কাজ করে। পরের সপ্তাহের Rotation অক্ষত থাকে।
exports.changeShiftMidWeek = async (req, res) => {
  try {
    const { rosterId, employeeId } = req.params;
    const { shiftCode, remarks } = req.body;

    if (!shiftCode) return res.status(400).json({ success: false, message: "shiftCode আবশ্যক" });

    const fromDate = parseDate(req.body.fromDate);
    if (!fromDate) return res.status(400).json({ success: false, message: "সঠিক fromDate দিন (YYYY-MM-DD)" });

    const roster = await WeeklyRoster.findOne({ _id: rosterId, company: req.companyId });
    if (!roster) return res.status(404).json({ success: false, message: "Roster পাওয়া যায়নি" });

    const weekStart = new Date(roster.weekStartDate);
    const weekEnd = new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
    const toDate = req.body.toDate ? parseDate(req.body.toDate) : weekEnd;

    if (!toDate) return res.status(400).json({ success: false, message: "সঠিক toDate দিন (YYYY-MM-DD)" });
    if (fromDate < weekStart || toDate > weekEnd) {
      return res.status(400).json({
        success: false,
        message: `তারিখ এই সপ্তাহের (${toDateString(weekStart)} থেকে ${toDateString(weekEnd)}) মধ্যে হতে হবে`,
      });
    }
    if (toDate < fromDate) {
      return res.status(400).json({ success: false, message: "শেষ তারিখ শুরুর তারিখের আগে হতে পারে না" });
    }

    const employee = await Employee.findOne({ _id: employeeId, company: req.companyId });
    if (!employee || employee.isDeleted) {
      return res.status(404).json({ success: false, message: "Employee পাওয়া যায়নি" });
    }

    const shift = await Shift.findOne({ company: req.companyId, code: String(shiftCode).toUpperCase(), isActive: true });
    if (!shift) return res.status(404).json({ success: false, message: "সঠিক Active Shift পাওয়া যায়নি" });

    const entry = roster.entries.find((item) => item.employee.toString() === employee._id.toString());
    if (!entry) return res.status(404).json({ success: false, message: "এই সপ্তাহের Roster-এ Employee নেই" });

    const DAY = 24 * 60 * 60 * 1000;
    const changedDates = [];
    let overrides = (entry.dayOverrides || []).map((o) => ({
      date: o.date,
      shift: o.shift,
      remarks: o.remarks,
    }));

    for (let d = new Date(fromDate); d <= toDate; d = new Date(d.getTime() + DAY)) {
      const time = d.getTime();
      overrides = overrides.filter((o) => new Date(o.date).getTime() !== time);

      // সপ্তাহের মূল শিফটের সমান হলে আলাদা Override রাখার দরকার নেই
      if (String(entry.shift) !== String(shift._id)) {
        overrides.push({ date: new Date(time), shift: shift._id, remarks: remarks || "" });
      }
      changedDates.push(toDateString(d));
    }

    overrides.sort((a, b) => new Date(a.date) - new Date(b.date));
    entry.dayOverrides = overrides;
    await roster.save();

    const recalculated = await recalcDates(changedDates, employee._id, req.companyId);

    const updatedRoster = await populateRoster(WeeklyRoster.findOne({ _id: roster._id, company: req.companyId }));
    return res.status(200).json({
      success: true,
      message: `${toDateString(fromDate)} থেকে ${toDateString(toDate)} পর্যন্ত ${shift.name} এ বদল হয়েছে`,
      data: updatedRoster,
      recalculated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE: মাঝ-সপ্তাহের বদল তুলে মূল শিফটে ফেরা
// Query: fromDate, toDate (না দিলে এই কর্মীর সব Override মুছবে)
exports.clearMidWeekChange = async (req, res) => {
  try {
    const { rosterId, employeeId } = req.params;

    const roster = await WeeklyRoster.findOne({ _id: rosterId, company: req.companyId });
    if (!roster) return res.status(404).json({ success: false, message: "Roster পাওয়া যায়নি" });

    const entry = roster.entries.find((item) => item.employee.toString() === employeeId);
    if (!entry) return res.status(404).json({ success: false, message: "এই সপ্তাহের Roster-এ Employee নেই" });

    const from = req.query.fromDate ? parseDate(req.query.fromDate) : null;
    const to = req.query.toDate ? parseDate(req.query.toDate) : null;

    const removedDates = [];
    entry.dayOverrides = (entry.dayOverrides || []).filter((o) => {
      const t = new Date(o.date).getTime();
      const inRange = (!from || t >= from.getTime()) && (!to || t <= to.getTime());
      if (inRange) removedDates.push(toDateString(new Date(o.date)));
      return !inRange;
    });
    await roster.save();

    const recalculated = await recalcDates(removedDates, entry.employee, req.companyId);

    const updatedRoster = await populateRoster(WeeklyRoster.findOne({ _id: roster._id, company: req.companyId }));
    return res.status(200).json({
      success: true,
      message: "মাঝ-সপ্তাহের শিফট বদল তুলে নেওয়া হয়েছে",
      data: updatedRoster,
      recalculated,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH: Roster Publish
exports.publishWeeklyRoster = async (req, res) => {
  try {
    const roster = await WeeklyRoster.findOneAndUpdate(
      { _id: req.params.rosterId, company: req.companyId },
      { status: "PUBLISHED" },
      { new: true, runValidators: true },
    );
    if (!roster) return res.status(404).json({ success: false, message: "Roster পাওয়া যায়নি" });
    return res.status(200).json({ success: true, message: "Weekly Roster Published হয়েছে", data: roster });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * নতুন Active কর্মী তৈরি হলে চলতি সপ্তাহের Roster-এ যোগ (প্যাটার্ন থাকলে)।
 * প্যাটার্ন না থাকলে কিছু করে না — Roster Plan পেজে "সেট নেই" হিসেবে দেখাবে।
 */
exports.addEmployeeToCurrentRoster = async (employee) => {
  try {
    if (!employee || !employee._id) return null;
    const status = String(employee.employmentStatus || "").toLowerCase();
    if (status && status !== "active") return null;

    const today = new Date();
    const weekStart = getSaturday(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())));

    const roster = await WeeklyRoster.findOne({ company: employee.company, weekStartDate: weekStart });
    if (!roster) return null;
    if (roster.entries.some((e) => e.employee && e.employee.toString() === employee._id.toString())) return roster;

    const list = await RosterAssignment.find({ company: employee.company, employee: employee._id }).sort({ effectiveFrom: 1 }).lean();
    const shiftId = resolveShiftId(list, weekStart);
    if (!shiftId) return null;

    roster.entries.push({
      employee: employee._id,
      employeeId: employee.employeeId,
      employeeName: employee.name,
      shift: shiftId,
      source: "AUTO",
      remarks: "Auto-added on employee create",
    });
    await roster.save();
    return roster;
  } catch (err) {
    console.error("addEmployeeToCurrentRoster error:", err.message);
    return null;
  }
};
