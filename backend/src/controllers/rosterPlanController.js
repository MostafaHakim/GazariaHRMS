const Employee = require("../models/Employee");
const Shift = require("../models/Shift");
const WeeklyRoster = require("../models/WeeklyRoster");
const RosterAssignment = require("../models/RosterAssignment");
const {
  ACTIVE,
  DAY_MS,
  parseDate,
  getSaturday,
  listWeeks,
  resolveShiftId,
  pickAssignment,
  loadAssignments,
  generateRange,
} = require("../services/rosterService");

const bad = (res, message, status = 400) => res.status(status).json({ success: false, message });

const rangeFromQuery = (source) => {
  const from = parseDate(source.from);
  const to = parseDate(source.to);
  if (!from || !to) return null;
  return { from: getSaturday(from), to: getSaturday(to) };
};

// GET /api/roster-plans/preview?from=&to=&department=&section=&search=
// প্যাটার্ন + (Manual থাকলে সেটি) মিলিয়ে সপ্তাহভিত্তিক ম্যাট্রিক্স। কিছু সেভ করে না।
exports.preview = async (req, res, next) => {
  try {
    const range = rangeFromQuery(req.query);
    if (!range) return bad(res, "from ও to (YYYY-MM-DD) দিন");
    const weeks = listWeeks(range.from, range.to);

    const base = { ...ACTIVE, company: req.companyId };
    if (req.query.department) base.department = req.query.department;
    const sections = (await Employee.distinct("section", base))
      .map((s) => String(s || "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    const filter = { ...base };
    if (req.query.section === "__NONE__") filter.$or = [{ section: "" }, { section: null }];
    else if (req.query.section) filter.section = req.query.section;
    if (req.query.search) {
      const s = String(req.query.search).trim();
      filter.$and = [{ $or: [{ employeeId: { $regex: s, $options: "i" } }, { name: { $regex: s, $options: "i" } }] }];
    }

    const employees = await Employee.find(filter)
      .select("employeeId name section department")
      .populate("department", "name")
      .sort({ section: 1, employeeId: 1 })
      .lean();

    const assignmentMap = await loadAssignments(employees.map((e) => e._id), req.companyId);
    const shifts = await Shift.find({ company: req.companyId, isActive: true })
      .select("name code startTime endTime isNightShift")
      .sort({ startTime: 1 })
      .lean();

    const rosters = await WeeklyRoster.find({ company: req.companyId, weekStartDate: { $gte: range.from, $lte: range.to } })
      .select("weekStartDate status entries.employee entries.shift entries.source")
      .lean();
    const rosterByWeek = new Map(
      rosters.map((r) => [r.weekStartDate.getTime(), { status: r.status, entries: new Map(r.entries.map((e) => [String(e.employee), e])) }]),
    );

    const now = getSaturday(new Date(Date.now() + 6 * 60 * 60 * 1000));
    let unassigned = 0;

    const rows = employees.map((emp) => {
      const list = assignmentMap.get(String(emp._id)) || [];
      const current = pickAssignment(list, weeks[weeks.length - 1]);
      const active = pickAssignment(list, now) || current;
      if (!active) unassigned++;
      const cells = weeks.map((week) => {
        const entry = rosterByWeek.get(week.getTime())?.entries.get(String(emp._id));
        if (entry && entry.source === "MANUAL") return { s: String(entry.shift), m: 1 };
        const id = resolveShiftId(list, week);
        return { s: id ? String(id) : null, m: 0 };
      });
      return {
        employee: { _id: emp._id, employeeId: emp.employeeId, name: emp.name, section: emp.section || "", department: emp.department?.name || "" },
        pattern: active
          ? { type: active.type, shifts: active.shifts.map(String), startIndex: active.startIndex, intervalWeeks: active.intervalWeeks, effectiveFrom: active.effectiveFrom }
          : null,
        cells,
      };
    });

    res.json({
      success: true,
      weeks: weeks.map((w) => w.toISOString().slice(0, 10)),
      weekStatus: weeks.map((w) => rosterByWeek.get(w.getTime())?.status || null),
      shifts,
      sections,
      unassigned,
      rows,
    });
  } catch (error) {
    next(error);
  }
};

const validateShifts = async (shiftIds, type, companyId) => {
  const unique = [...new Set((shiftIds || []).map(String))];
  if (type === "FIXED" && unique.length !== 1) throw new Error("Fixed-এর জন্য ঠিক ১টি শিফট দিন");
  if (type === "ROTATE" && unique.length < 2) throw new Error("Rotate-এর জন্য কমপক্ষে ২টি আলাদা শিফট দিন");
  const found = await Shift.find({ _id: { $in: unique }, company: companyId, isActive: true }).select("_id").lean();
  if (found.length !== unique.length) throw new Error("এক বা একাধিক শিফট Active নয়");
  return unique; // ক্রম রাখা হলো: প্রথমটি = শুরুর শিফট
};

// POST /api/roster-plans/assign
// { employeeIds, type: FIXED|ROTATE, shiftIds: [..], intervalWeeks, effectiveFrom, generateTo? }
exports.assign = async (req, res, next) => {
  try {
    const { employeeIds, type, shiftIds, intervalWeeks = 1, effectiveFrom, generateTo } = req.body;
    if (!Array.isArray(employeeIds) || !employeeIds.length) return bad(res, "কমপক্ষে একজন কর্মী নির্বাচন করুন");
    if (!["FIXED", "ROTATE"].includes(type)) return bad(res, "type FIXED অথবা ROTATE হতে হবে");
    const from = parseDate(effectiveFrom);
    if (!from) return bad(res, "সঠিক effectiveFrom দিন");
    const interval = Number(intervalWeeks);
    if (!Number.isInteger(interval) || interval < 1 || interval > 52) return bad(res, "Interval ১ থেকে ৫২ সপ্তাহের মধ্যে হতে হবে");

    let ordered;
    try {
      ordered = await validateShifts(shiftIds, type, req.companyId);
    } catch (e) {
      return bad(res, e.message);
    }

    const start = getSaturday(from);
    const employees = await Employee.find({ _id: { $in: employeeIds }, company: req.companyId, ...ACTIVE }).select("_id").lean();
    if (!employees.length) return bad(res, "Active কর্মী পাওয়া যায়নি", 404);
    const ids = employees.map((e) => e._id);

    // এই তারিখ ও তার পরের পুরোনো প্যাটার্ন বাতিল — নতুনটাই সামনের সব সপ্তাহে চলবে
    await RosterAssignment.deleteMany({ company: req.companyId, employee: { $in: ids }, effectiveFrom: { $gte: start } });
    await RosterAssignment.insertMany(
      ids.map((id) => ({ company: req.companyId, employee: id, type, shifts: ordered, startIndex: 0, intervalWeeks: type === "ROTATE" ? interval : 1, effectiveFrom: start })),
    );

    let generated = null;
    const to = parseDate(generateTo);
    if (to) generated = await generateRange({ from: start, to: getSaturday(to), employeeIds: ids, companyId: req.companyId });

    res.json({ success: true, message: `${ids.length} জন কর্মীর প্যাটার্ন সেভ হয়েছে`, count: ids.length, generated });
  } catch (error) {
    next(error);
  }
};

// POST /api/roster-plans/generate { from, to, employeeIds?, overwriteManual? }
exports.generate = async (req, res, next) => {
  try {
    const range = rangeFromQuery(req.body);
    if (!range) return bad(res, "from ও to (YYYY-MM-DD) দিন");
    const summary = await generateRange({
      ...range,
      companyId: req.companyId,
      employeeIds: req.body.employeeIds,
      overwriteManual: Boolean(req.body.overwriteManual),
    });
    if (summary.created + summary.updated + summary.manualPreserved === 0) {
      return bad(res, "কোনো কর্মীর প্যাটার্ন সেট নেই। আগে প্যাটার্ন দিন।");
    }
    res.json({ success: true, message: `${summary.weeks} সপ্তাহের Roster Generate হয়েছে (Draft)`, summary });
  } catch (error) {
    next(error);
  }
};

// POST /api/roster-plans/publish { from, to }
exports.publishRange = async (req, res, next) => {
  try {
    const range = rangeFromQuery(req.body);
    if (!range) return bad(res, "from ও to (YYYY-MM-DD) দিন");
    const result = await WeeklyRoster.updateMany(
      { company: req.companyId, weekStartDate: { $gte: range.from, $lte: range.to } },
      { $set: { status: "PUBLISHED" } },
    );
    res.json({ success: true, message: `${result.modifiedCount} সপ্তাহের Roster Published`, modified: result.modifiedCount });
  } catch (error) {
    next(error);
  }
};

// PUT /api/roster-plans/override
// { employeeId, weekStartDate, shiftId, scope: "WEEK" | "ONWARD", remarks }
//  WEEK  : শুধু ওই সপ্তাহ। প্যাটার্ন/Rotation অক্ষত।
//  ONWARD: ওই সপ্তাহ থেকে নতুন প্যাটার্ন; শিফটটি Rotate তালিকায় থাকলে Rotation চলতে থাকে।
exports.override = async (req, res, next) => {
  try {
    const { employeeId, weekStartDate, shiftId, scope = "WEEK", remarks = "" } = req.body;
    const weekDate = parseDate(weekStartDate);
    if (!weekDate) return bad(res, "সঠিক weekStartDate দিন");
    if (!["WEEK", "ONWARD"].includes(scope)) return bad(res, "scope WEEK অথবা ONWARD হতে হবে");

    const [employee, shift] = await Promise.all([
      Employee.findOne({ _id: employeeId, company: req.companyId, ...ACTIVE }),
      Shift.findOne({ _id: shiftId, company: req.companyId, isActive: true }),
    ]);
    if (!employee) return bad(res, "Employee পাওয়া যায়নি", 404);
    if (!shift) return bad(res, "Active Shift পাওয়া যায়নি", 404);
    const week = getSaturday(weekDate);

    if (scope === "WEEK") {
      let roster = await WeeklyRoster.findOne({ company: req.companyId, weekStartDate: week });
      if (!roster) {
        roster = new WeeklyRoster({ company: req.companyId, weekStartDate: week, weekEndDate: new Date(week.getTime() + 6 * DAY_MS), entries: [], status: "DRAFT" });
      }
      const entry = roster.entries.find((e) => String(e.employee) === String(employee._id));
      if (entry) {
        entry.shift = shift._id;
        entry.source = "MANUAL";
        entry.remarks = remarks;
      } else {
        roster.entries.push({ employee: employee._id, employeeId: employee.employeeId, employeeName: employee.name, shift: shift._id, source: "MANUAL", remarks });
      }
      await roster.save();
      return res.json({ success: true, message: "এই সপ্তাহের শিফট বদলানো হয়েছে" });
    }

    const list = await RosterAssignment.find({ company: req.companyId, employee: employee._id }).sort({ effectiveFrom: 1 }).lean();
    const current = pickAssignment(list, week);
    let doc;
    const idx = current?.type === "ROTATE" ? current.shifts.findIndex((s) => String(s) === String(shift._id)) : -1;
    if (idx >= 0) {
      doc = { type: "ROTATE", shifts: current.shifts, startIndex: idx, intervalWeeks: current.intervalWeeks };
    } else {
      doc = { type: "FIXED", shifts: [shift._id], startIndex: 0, intervalWeeks: 1 };
    }
    await RosterAssignment.deleteMany({ company: req.companyId, employee: employee._id, effectiveFrom: { $gte: week } });
    await RosterAssignment.create({ company: req.companyId, employee: employee._id, effectiveFrom: week, ...doc });

    const last = await WeeklyRoster.findOne({ company: req.companyId }).sort({ weekStartDate: -1 }).select("weekStartDate").lean();
    const to = last && last.weekStartDate > week ? last.weekStartDate : week;
    const summary = await generateRange({ from: week, to, employeeIds: [employee._id], companyId: req.companyId, overwriteManual: true });
    res.json({
      success: true,
      message: doc.type === "ROTATE" ? "এই সপ্তাহ থেকে নতুন শিফটে Rotation চলবে" : "এই সপ্তাহ থেকে শিফট Fixed করা হয়েছে",
      summary,
    });
  } catch (error) {
    next(error);
  }
};
