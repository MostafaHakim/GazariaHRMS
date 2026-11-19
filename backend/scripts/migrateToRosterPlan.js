/**
 * পুরোনো Shift Rotation / Shift Groups / Fixed ডেটা → নতুন RosterAssignment
 * চালান:  node scripts/migrateToRosterPlan.js          (শুধু রিপোর্ট, কিছু লেখে না)
 *         node scripts/migrateToRosterPlan.js --apply  (সত্যিই লেখে)
 * যাদের আগে থেকেই RosterAssignment আছে তাদের ছোঁয়া হয় না।
 */
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const Employee = require("../src/models/Employee");
const Shift = require("../src/models/Shift");
const ShiftRotation = require("../src/models/ShiftRotation");
const RosterAssignment = require("../src/models/RosterAssignment");
const { getSaturday } = require("../src/services/rosterService");

const APPLY = process.argv.includes("--apply");

(async () => {
  await connectDB();
  const shifts = await Shift.find({ isActive: true });
  const day = shifts.find((s) => s.code === "DAY-01");
  const night = shifts.find((s) => s.code === "NIGHT-01");
  const existing = new Set((await RosterAssignment.find().select("employee").lean()).map((a) => String(a.employee)));
  const docs = [];
  const notes = [];
  const add = (emp, doc, from) => {
    const key = String(emp);
    if (existing.has(key)) return;
    existing.add(key);
    docs.push({ employee: emp, effectiveFrom: getSaturday(from), ...doc });
  };

  // 1) Active Shift Rotation Group (Continuous)
  const plans = await ShiftRotation.find({ isActive: true });
  for (const plan of plans) {
    const weeks = plan.intervalDays / 7;
    if (!Number.isInteger(weeks)) notes.push(`"${plan.name}": interval ${plan.intervalDays} দিন ৭-এর গুণিতক নয় — সপ্তাহে রাউন্ড করা হলো`);
    for (const m of plan.members) {
      if (!m.rotationEnabled) {
        add(m.employee, { type: "FIXED", shifts: [m.manualShift || m.startShift], startIndex: 0, intervalWeeks: 1 }, plan.startDate);
      } else {
        const idx = Math.max(0, plan.shifts.findIndex((id) => String(id) === String(m.startShift)));
        add(m.employee, { type: "ROTATE", shifts: plan.shifts, startIndex: idx, intervalWeeks: Math.max(1, Math.round(weeks)) }, m.anchorDate);
      }
    }
  }

  // 2) Shift Groups (Employee.shiftPolicy = ROTATING) ও FIXED
  const employees = await Employee.find({ isDeleted: { $ne: true }, employmentStatus: { $in: ["Active", "active", "ACTIVE"] } });
  const skipped = [];
  for (const e of employees) {
    if (existing.has(String(e._id))) continue;
    if (e.shiftPolicy === "FIXED" && e.shift) {
      add(e._id, { type: "FIXED", shifts: [e.shift], startIndex: 0, intervalWeeks: 1 }, e.rotationStartDate || new Date());
    } else if (e.shiftPolicy === "ROTATING" && e.rotationStartDate && day && night) {
      add(e._id, { type: "ROTATE", shifts: [day._id, night._id], startIndex: e.rotationStartShift === "NIGHT" ? 1 : 0, intervalWeeks: 1 }, e.rotationStartDate);
    } else {
      skipped.push(e.employeeId);
    }
  }

  console.log(`নতুন প্যাটার্ন: ${docs.length} জন`);
  notes.forEach((n) => console.log("নোট:", n));
  console.log(`প্যাটার্ন ছাড়া (Roster Plan পেজে হাতে দিতে হবে): ${skipped.length} জন`, skipped.slice(0, 30).join(", "));
  if (APPLY && docs.length) {
    await RosterAssignment.insertMany(docs);
    console.log("সেভ হয়েছে।");
  } else {
    console.log(APPLY ? "লেখার কিছু নেই।" : "ড্রাই-রান: --apply দিয়ে আবার চালান।");
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
