const { PayrollRun, PayrollLine } = require("../models/Payroll");
const Company = require("../models/Company");
const {
  generatePayroll,
  updateLine,
  buildSummary,
  sortLines,
  fillMissingSections,
  sectionName,
  sectionKey,
} = require("../services/payrollService");
const { buildWorkbook, exportFileName, PAYMENT_ORDER } = require("../services/payrollExportService");
const { createPayrollPaymentRecords } = require("../services/payrollPaymentService");
const { writeAudit } = require("../services/auditService");
const {
  findLoanConflicts,
  conflictMessage,
  applyLoanDeductions,
} = require("../services/advanceService");

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const validMonth = (month, res) => {
  if (!month || !MONTH_RE.test(month)) {
    res.status(400).json({
      success: false,
      message: "Valid month is required. Use YYYY-MM format.",
    });
    return false;
  }
  return true;
};

const loadRunWithLines = async (month, companyId) => {
  const run = await PayrollRun.findOne({ month, company: companyId })
    .populate("generatedBy finalizedBy paidBy", "name username")
    .lean();
  if (!run) return { run: null, lines: [] };

  const rawLines = await PayrollLine.find({ company: companyId, run: run._id }).lean();
  const lines = sortLines(await fillMissingSections(rawLines, companyId)).map(
    (l, i) => ({ ...l, sl: i + 1 }),
  );
  return { run, lines };
};

// GET /api/payroll?month=YYYY-MM
exports.getPayroll = async (req, res, next) => {
  try {
    const { month } = req.query;
    if (!validMonth(month, res)) return;

    const { run, lines } = await loadRunWithLines(month, req.companyId);
    res.json({
      success: true,
      run,
      lines,
      summary: run ? buildSummary(lines) : null,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/payroll/generate   { month }
exports.generate = async (req, res, next) => {
  try {
    const { month } = req.body;
    if (!validMonth(month, res)) return;

    const result = await generatePayroll(month, req.user._id, req.companyId);
    const { run, lines } = await loadRunWithLines(month, req.companyId);

    res.json({
      success: true,
      message: `Payroll generated: ${result.created} new, ${result.updated} refreshed`,
      run,
      lines,
      summary: buildSummary(lines),
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// PATCH /api/payroll/lines/:id
exports.editLine = async (req, res, next) => {
  try {
    const line = await updateLine(req.params.id, req.body, req.companyId);
    res.json({ success: true, line: line.toObject() });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// before(run) স্ট্রিং ফিরিয়ে দিলে সেটা 409 হিসেবে যায় (পরিবর্তন হয় না); extra(run, uid) async হতে পারে
const changeStatus = (from, to, extra, before) => async (req, res, next) => {
  try {
    const run = await PayrollRun.findOne({ month: req.params.month, company: req.companyId });
    if (!run) {
      return res.status(404).json({ success: false, message: "Payroll not found" });
    }
    if (run.status !== from) {
      return res.status(409).json({
        success: false,
        message: `Payroll is ${run.status}; expected ${from}`,
      });
    }
    if (before) {
      const blocked = await before(run);
      if (blocked) return res.status(409).json({ success: false, message: blocked });
    }
    run.status = to;
    await extra(run, req.user._id, req);
    await run.save();
    await writeAudit(req, {
      action: `STATUS_${to}`,
      module: "PAYROLL",
      targetId: run._id,
      details: { month: run.month, from, to },
    });
    res.json({ success: true, run });
  } catch (error) {
    next(error);
  }
};

// Advance/Loan কিস্তি বদলে গেলে (বাতিল/ক্লোজ/অন্য পেরোলে কাটা) আটকে দেয় — ডাবল কাটা ঠেকাতে
const loanGuard = async (run) => {
  const conflicts = await findLoanConflicts(run);
  return conflicts.length ? conflictMessage(conflicts) : null;
};

// POST /api/payroll/:month/finalize | /mark-paid | /reopen
exports.finalize = changeStatus(
  "DRAFT",
  "FINALIZED",
  (run, uid) => {
    run.finalizedAt = new Date();
    run.finalizedBy = uid;
  },
  loanGuard,
);
// Mark Paid এ Advance/Loan কিস্তিগুলো "কাটা হয়েছে" হয়ে যায়; সব কিস্তি শেষ হলে লোন CLOSED
exports.markPaid = changeStatus(
  "FINALIZED",
  "PAID",
  async (run, uid) => {
    // Loan deductions are idempotent (only deducted:false entries are updated).
    // Payment records use a unique payrollRun+employee key, so retries cannot duplicate them.
    await applyLoanDeductions(run);
    const paidAt = new Date();
    await createPayrollPaymentRecords(run, uid, paidAt);
    run.paidAt = paidAt;
    run.paidBy = uid;
  },
  loanGuard,
);
exports.reopen = changeStatus("FINALIZED", "DRAFT", (run) => {
  run.finalizedAt = null;
  run.finalizedBy = null;
});

// DELETE /api/payroll/:month  (শুধু DRAFT)
exports.removeRun = async (req, res, next) => {
  try {
    const run = await PayrollRun.findOne({ month: req.params.month, company: req.companyId });
    if (!run) {
      return res.status(404).json({ success: false, message: "Payroll not found" });
    }
    if (run.status !== "DRAFT") {
      return res.status(409).json({
        success: false,
        message: "Only DRAFT payroll can be deleted",
      });
    }
    await PayrollLine.deleteMany({ company: req.companyId, run: run._id });
    await run.deleteOne();
    res.json({ success: true, message: "Payroll deleted" });
  } catch (error) {
    next(error);
  }
};

// GET /api/payroll/export?month=YYYY-MM[&sections=A,B]  → .xlsx (Payroll Summary, Report, TOP_SHEET, BKASH ...)
exports.exportExcel = async (req, res, next) => {
  try {
    const { month } = req.query;
    if (!validMonth(month, res)) return;

    const { run, lines } = await loadRunWithLines(month, req.companyId);
    if (!run) {
      return res.status(404).json({
        success: false,
        message: "এই মাসের পেরোল এখনো তৈরি হয়নি",
      });
    }

    // সেকশন ফিল্টার: ?sections=Covering,Needle  (খালি = সব সেকশন; "No Section" = সেকশন ফাঁকা কর্মীরা)
    const rawFilter = String(req.query.sections || req.query.section || "");
    const wanted = rawFilter
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    const exportLines = wanted.length
      ? lines
          .filter((l) => wanted.includes(sectionKey(l)))
          .map((l, i) => ({ ...l, sl: i + 1 }))
      : lines;

    if (wanted.length && exportLines.length === 0) {
      return res.status(404).json({
        success: false,
        message: "এই সেকশনে কোনো কর্মী পাওয়া যায়নি",
      });
    }

    // শিটের টাইটেলে দেখানোর নাম (একাধিক হলে সবগুলোর নাম, ক্রম বজায় রেখে)
    const scopeNames = [...new Set(exportLines.map(sectionName))];
    const scope = wanted.length ? scopeNames.join(", ") : "";

    // কোন অংশ এক্সপোর্ট: full (ডিফল্ট) | sheet | summary | payment[&method=Bkash|Bank|Cash|Hold]
    const type = String(req.query.type || "full");
    const method = String(req.query.method || "");
    if (!["full", "sheet", "summary", "payment"].includes(type)) {
      return res.status(400).json({ success: false, message: "Invalid export type" });
    }
    if (method && (type !== "payment" || !PAYMENT_ORDER.includes(method))) {
      return res.status(400).json({ success: false, message: "Invalid payment method" });
    }
    if (type === "payment") {
      const pay = exportLines.filter((l) => (!method || l.method === method) && l.netPayable > 0);
      if (!pay.length) {
        return res.status(404).json({
          success: false,
          message: method ? `${method} তালিকায় কোনো পেমেন্ট নেই` : "কোনো পেমেন্ট নেই",
        });
      }
    }

    const workbook = await buildWorkbook(month, exportLines, { scope, type, method });
    const part = { full: "Payroll_Sheet", sheet: "Payroll_Sheet_Only", summary: "Section_Summary", payment: method ? `Payment_${method}` : "Payment_List" }[type];
    const baseName = exportFileName(month, part);
    // Content-Disposition এ শুধু ASCII চলে; বাংলা নাম হলে ফাইলনামে সাধারণ লেবেল বসে
    const safe = (v) => v.replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "");
    const suffix = !wanted.length
      ? ""
      : scopeNames.length === 1
        ? safe(scopeNames[0]) || "Section"
        : "Selected_Sections";
    const fileName = suffix ? baseName.replace(".xlsx", `_${suffix}.xlsx`) : baseName;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`,
    );
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
};

// GET /api/payroll/group-summary?month=YYYY-MM — Group Admin read-only consolidated view
exports.groupSummary = async (req, res, next) => {
  try {
    const { month } = req.query;
    if (!validMonth(month, res)) return;
    if (req.user.role !== "ADMIN") return res.status(403).json({ success: false, message: "Group Admin only" });
    const companies = await Company.find({ isActive: true }).select("_id name code").sort({ name: 1 }).lean();
    const rows = await Promise.all(companies.map(async (company) => {
      const run = await PayrollRun.findOne({ company: company._id, month }).lean();
      if (!run) return { company, run: null, summary: null };
      const lines = await PayrollLine.find({ company: company._id, run: run._id }).lean();
      return { company, run: { month: run.month, status: run.status }, summary: buildSummary(lines) };
    }));
    const totals = rows.reduce((acc, row) => {
      if (!row.summary) return acc;
      const t = row.summary.totals;
      acc.headcount += t.headcount || 0;
      acc.netPayable += t.netPayable || 0;
      acc.basicSalary += t.basicSalary || 0;
      acc.otAmount += t.otAmount || 0;
      acc.loanDeduction += t.loanDeduction || 0;
      return acc;
    }, { headcount: 0, netPayable: 0, basicSalary: 0, otAmount: 0, loanDeduction: 0 });
    res.json({ success: true, month, companies: rows, totals });
  } catch (error) { next(error); }
};
