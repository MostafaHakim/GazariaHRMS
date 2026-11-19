const Employee = require("../models/Employee");
const Shift = require("../models/Shift");
const WeeklyRoster = require("../models/WeeklyRoster");
const RosterAssignment = require("../models/RosterAssignment");

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const MAX_WEEKS = 110;

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

// শনিবার = সপ্তাহের প্রথম দিন, শুক্রবার = সাপ্তাহিক ছুটি
const getSaturday = (date) => {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);
  result.setUTCDate(result.getUTCDate() - ((result.getUTCDay() + 1) % 7));
  return result;
};

const weeksBetween = (a, b) => Math.round((b.getTime() - a.getTime()) / WEEK_MS);

const listWeeks = (from, to) => {
  if (to < from) throw new Error("শেষ তারিখ শুরুর তারিখের আগে হতে পারে না");
  const weeks = [];
  for (let d = new Date(from); d <= to; d = new Date(d.getTime() + WEEK_MS)) {
    weeks.push(d);
    if (weeks.length > MAX_WEEKS) throw new Error(`একবারে সর্বোচ্চ ${MAX_WEEKS} সপ্তাহ`);
  }
  return weeks;
};

const pickAssignment = (list, weekStart) => {
  let found = null;
  for (const item of list) {
    if (item.effectiveFrom <= weekStart) found = item;
    else break;
  }
  return found;
};

// ★ একমাত্র হিসাবের ফাংশন: কোন সপ্তাহে কর্মী কোন শিফটে (list = effectiveFrom ASC)
const resolveShiftId = (list, weekStart) => {
  const a = pickAssignment(list || [], weekStart);
  if (!a || !a.shifts?.length) return null;
  if (a.type === "FIXED") return a.shifts[0];
  const steps = Math.floor(weeksBetween(a.effectiveFrom, weekStart) / (a.intervalWeeks || 1));
  return a.shifts[(a.startIndex + steps) % a.shifts.length];
};

const groupAssignments = (assignments) => {
  const map = new Map();
  for (const a of assignments) {
    const key = String(a.employee);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(a);
  }
  return map;
};

const loadAssignments = async (employeeIds, companyId) => {
  const list = await RosterAssignment.find({ company: companyId, employee: { $in: employeeIds } })
    .sort({ effectiveFrom: 1 })
    .lean();
  return groupAssignments(list);
};

const ACTIVE = { isDeleted: { $ne: true }, employmentStatus: { $in: ["Active", "active", "ACTIVE"] } };

/**
 * from..to (শনিবার-ভিত্তিক সপ্তাহ) রেঞ্জের WeeklyRoster প্যাটার্ন থেকে তৈরি/আপডেট।
 * MANUAL এন্ট্রি overwriteManual=true না হলে অক্ষত থাকে। প্যাটার্ন না থাকা কর্মী বাদ যায়।
 */
const generateRange = async ({ from, to, employeeIds, companyId, overwriteManual = false }) => {
  if (!companyId) throw new Error("Roster Generate করার জন্য Company নির্বাচন করুন");
  const weeks = listWeeks(from, to);
  const filter = { ...ACTIVE, company: companyId };
  if (employeeIds?.length) filter._id = { $in: employeeIds };
  const employees = await Employee.find(filter).select("employeeId name").lean();
  const assignmentMap = await loadAssignments(employees.map((e) => e._id), companyId);
  const activeShiftIds = new Set(
    (await Shift.find({ company: companyId, isActive: true }).select("_id").lean()).map((s) => String(s._id)),
  );

  const unassigned = new Set();
  const invalid = new Set();
  let created = 0;
  let updated = 0;
  let manualPreserved = 0;
  let weeksSaved = 0;

  for (const week of weeks) {
    let roster = await WeeklyRoster.findOne({ company: companyId, weekStartDate: week });
    const isNew = !roster;
    if (!roster) {
      roster = new WeeklyRoster({
        company: companyId,
        weekStartDate: week,
        weekEndDate: new Date(week.getTime() + 6 * DAY_MS),
        entries: [],
        status: "DRAFT",
      });
    }
    const entryMap = new Map(roster.entries.map((e) => [String(e.employee), e]));
    let changed = false;

    for (const emp of employees) {
      const key = String(emp._id);
      const existing = entryMap.get(key);
      if (existing && existing.source === "MANUAL" && !overwriteManual) {
        manualPreserved++;
        continue;
      }
      const shiftId = resolveShiftId(assignmentMap.get(key), week);
      if (!shiftId) {
        unassigned.add(key);
        continue;
      }
      if (!activeShiftIds.has(String(shiftId))) {
        invalid.add(key);
        continue;
      }
      if (existing) {
        if (String(existing.shift) !== String(shiftId) || existing.source !== "AUTO") {
          existing.shift = shiftId;
          existing.source = "AUTO";
          existing.remarks = "";
          changed = true;
          updated++;
        }
        existing.employeeId = emp.employeeId;
        existing.employeeName = emp.name;
      } else {
        roster.entries.push({
          employee: emp._id,
          employeeId: emp.employeeId,
          employeeName: emp.name,
          shift: shiftId,
          source: "AUTO",
        });
        changed = true;
        created++;
      }
    }

    if (changed || (!isNew && roster.isModified())) {
      await roster.save();
      weeksSaved++;
    }
  }

  return {
    weeks: weeks.length,
    weeksSaved,
    totalEmployees: employees.length,
    created,
    updated,
    manualPreserved,
    unassigned: unassigned.size,
    invalidShift: invalid.size,
  };
};

module.exports = {
  ACTIVE,
  DAY_MS,
  WEEK_MS,
  parseDate,
  getSaturday,
  listWeeks,
  resolveShiftId,
  pickAssignment,
  loadAssignments,
  generateRange,
};
