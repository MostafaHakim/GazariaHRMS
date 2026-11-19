const AdvanceLoan = require("../models/AdvanceLoan");
const { PayrollRun, PayrollLine } = require("../models/Payroll");
const { computeLine } = require("./payrollCalc");

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const money2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

const addMonths = (month, n) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

// বাংলাদেশের বর্তমান মাস (YYYY-MM)
const bdCurrentMonth = () => new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 7);

// মোট টাকাকে কিস্তিতে ভাগ: পয়সা পর্যন্ত হিসাব, বাকিটা শেষ কিস্তিতে
const buildSchedule = (amount, installments, startMonth) => {
  const n = Math.max(1, Math.floor(installments));
  const cents = Math.round(Number(amount) * 100);
  const base = Math.floor(cents / n);
  return Array.from({ length: n }, (_, i) => ({
    month: addMonths(startMonth, i),
    amount: (i === n - 1 ? cents - base * (n - 1) : base) / 100,
    deducted: false,
  }));
};

const recoveredOf = (loan) =>
  money2((loan.schedule || []).filter((s) => s.deducted).reduce((t, s) => t + s.amount, 0));

// ---------- পেরোলের জন্য: মাসে কার কত কাটা হবে ----------
// month <= পেরোল মাস এবং এখনো না-কাটা কিস্তি ধরা হয় (আগের মাসের বাদ পড়া কিস্তিও পরের পেরোলে উঠে আসে)।
const loadLoanDeductions = async (month, companyId, employeeIds = null) => {
  const filter = {
    company: companyId,
    status: "APPROVED",
    schedule: { $elemMatch: { deducted: false, month: { $lte: month } } },
  };
  if (employeeIds) filter.employee = { $in: employeeIds };

  const loans = await AdvanceLoan.find(filter).lean();
  const byEmployee = new Map();

  for (const loan of loans) {
    const key = String(loan.employee);
    const total = loan.schedule.length;
    loan.schedule.forEach((entry, idx) => {
      if (entry.deducted || entry.month > month) return;
      let rec = byEmployee.get(key);
      if (!rec) {
        rec = { total: 0, refs: [] };
        byEmployee.set(key, rec);
      }
      const base = loan.type === "LOAN" ? "Loan" : "Advance";
      rec.refs.push({
        loan: loan._id,
        entry: entry._id,
        month: entry.month,
        amount: entry.amount,
        label: total > 1 ? `${base} ${idx + 1}/${total}` : base,
      });
      rec.total = money2(rec.total + entry.amount);
    });
  }
  return byEmployee;
};

// ---------- Finalize / Mark Paid এর আগে যাচাই ----------
// পেরোলে ধরা কোনো কিস্তি যদি এর মধ্যে বাতিল/ক্লোজ/অন্য মাসে কাটা হয়ে যায়, তাহলে ডাবল-কাটা এড়াতে আটকে দেওয়া হয়।
const findLoanConflicts = async (run) => {
  const lines = await PayrollLine.find({ company: run.company, run: run._id, "loanRefs.0": { $exists: true } })
    .select("employeeId name loanRefs")
    .lean();
  if (!lines.length) return [];

  const loanIds = [...new Set(lines.flatMap((l) => l.loanRefs.map((r) => String(r.loan))))];
  const loans = await AdvanceLoan.find({ company: run.company, _id: { $in: loanIds } }).lean();
  const loanById = new Map(loans.map((l) => [String(l._id), l]));

  const conflicts = [];
  for (const line of lines) {
    for (const ref of line.loanRefs) {
      const loan = loanById.get(String(ref.loan));
      const entry = loan?.schedule.find((s) => String(s._id) === String(ref.entry));
      const doneHere = entry?.deducted && entry.payrollMonth === run.month; // আগের Mark Paid চেষ্টায় হয়ে গেছে
      const stillOpen = loan?.status === "APPROVED" && entry && !entry.deducted;
      if (!doneHere && !stillOpen) {
        conflicts.push({ employeeId: line.employeeId, name: line.name, label: ref.label });
        break;
      }
    }
  }
  return conflicts;
};

const conflictMessage = (conflicts) =>
  `${conflicts.length} জনের Advance/Loan কিস্তি বদলে গেছে (বাতিল/ক্লোজ/অন্য পেরোলে কাটা): ` +
  `${conflicts.slice(0, 5).map((c) => `${c.name} (${c.employeeId})`).join(", ")}` +
  `${conflicts.length > 5 ? " ..." : ""}। Reopen করে Regenerate করুন।`;

// ---------- Mark Paid: কিস্তিগুলো "কাটা হয়েছে" চিহ্নিত ----------
const applyLoanDeductions = async (run) => {
  const lines = await PayrollLine.find({ company: run.company, run: run._id, "loanRefs.0": { $exists: true } })
    .select("loanRefs")
    .lean();
  const now = new Date();
  const touchedLoans = new Set();

  for (const line of lines) {
    for (const ref of line.loanRefs) {
      await AdvanceLoan.updateOne(
        { company: run.company, _id: ref.loan, schedule: { $elemMatch: { _id: ref.entry, deducted: false } } },
        {
          $set: {
            "schedule.$.deducted": true,
            "schedule.$.deductedAt": now,
            "schedule.$.payrollMonth": run.month,
          },
        },
      );
      touchedLoans.add(String(ref.loan));
    }
  }

  // সব কিস্তি কাটা হয়ে গেলে লোন CLOSED
  for (const id of touchedLoans) {
    const loan = await AdvanceLoan.findOne({ _id: id, company: run.company });
    if (loan && loan.status === "APPROVED" && loan.schedule.every((s) => s.deducted)) {
      loan.status = "CLOSED";
      loan.closedAt = now;
      await loan.save();
    }
  }
  return touchedLoans.size;
};

// ---------- Approve / Cancel / Close এর পর চলমান DRAFT পেরোলে সাথে সাথে প্রতিফলন ----------
const refreshDraftRunsForEmployee = async (employeeId, companyId) => {
  const runs = await PayrollRun.find({ company: companyId, status: "DRAFT" }).select("_id month").lean();
  for (const run of runs) {
    const line = await PayrollLine.findOne({ company: companyId, run: run._id, employee: employeeId });
    if (!line) continue;
    const ded = (await loadLoanDeductions(run.month, companyId, [employeeId])).get(String(employeeId));
    line.loanDeduction = ded?.total || 0;
    line.loanRefs = ded?.refs || [];
    Object.assign(line, computeLine(line));
    await line.save();
  }
};

module.exports = {
  MONTH_RE,
  addMonths,
  bdCurrentMonth,
  buildSchedule,
  recoveredOf,
  money2,
  loadLoanDeductions,
  findLoanConflicts,
  conflictMessage,
  applyLoanDeductions,
  refreshDraftRunsForEmployee,
};
