const AdvanceLoan = require("../models/AdvanceLoan");
const Employee = require("../models/Employee");
const { PayrollRun } = require("../models/Payroll");
const cfg = require("../config/advanceConfig");
const {
  MONTH_RE,
  bdCurrentMonth,
  buildSchedule,
  recoveredOf,
  money2,
  refreshDraftRunsForEmployee,
} = require("../services/advanceService");

const fail = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const sendError = (error, res, next) => {
  if (error.status) return res.status(error.status).json({ success: false, message: error.message });
  if (error.name === "CastError") return res.status(400).json({ success: false, message: "Invalid id" });
  return next(error);
};

const isApprover = (user) => cfg.APPROVER_ROLES.includes(user.role);
const isOwner = (loan, user) => String(loan.requestedBy) === String(user._id);

const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

// রেসপন্সের জন্য হিসাব যোগ
const shape = (loan) => {
  const l = loan.toObject ? loan.toObject() : loan;
  const recovered = recoveredOf(l);
  const open = (l.schedule || []).filter((s) => !s.deducted);
  const first = (l.schedule || [])[0];
  return {
    ...l,
    recovered,
    outstanding: ["APPROVED"].includes(l.status) ? money2(l.amount - recovered) : 0,
    installmentAmount: first ? first.amount : money2(l.amount / (l.installments || 1)),
    nextDue: open[0]?.month || null,
  };
};

// ইনপুট যাচাই (create ও update এ একই)
const validateInput = async (body, { employee } = {}) => {
  const type = String(body.type || "ADVANCE").toUpperCase();
  if (!cfg.TYPES.includes(type)) throw fail(400, "Invalid type");

  const category = String(body.category || "SALARY_ADVANCE").toUpperCase();
  if (!cfg.CATEGORIES.includes(category)) throw fail(400, "Invalid category");

  const amount = money2(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw fail(400, "টাকার পরিমাণ সঠিক দিন");
  if (amount > cfg.MAX_AMOUNT) throw fail(400, `সর্বোচ্চ ${cfg.MAX_AMOUNT} টাকা দেওয়া যাবে`);

  const installments = Math.floor(Number(body.installments ?? 1));
  if (!Number.isFinite(installments) || installments < 1 || installments > cfg.MAX_INSTALLMENTS) {
    throw fail(400, `কিস্তি ১ থেকে ${cfg.MAX_INSTALLMENTS} এর মধ্যে হতে হবে`);
  }

  const startMonth = String(body.startMonth || bdCurrentMonth());
  if (!MONTH_RE.test(startMonth)) throw fail(400, "প্রথম কিস্তির মাস YYYY-MM ফরম্যাটে দিন");

  let issueDate = null;
  if (body.issueDate) {
    issueDate = parseDate(body.issueDate);
    if (!issueDate) throw fail(400, "Invalid issue date");
  }

  if (employee && type === "ADVANCE" && cfg.ADVANCE_MAX_PERCENT_OF_SALARY > 0) {
    const salary = Number(employee.basicSalary) || Number(employee.grossSalary) || 0;
    const cap = (salary * cfg.ADVANCE_MAX_PERCENT_OF_SALARY) / 100;
    if (salary > 0 && amount > cap) {
      throw fail(400, `অ্যাডভান্স বেতনের ${cfg.ADVANCE_MAX_PERCENT_OF_SALARY}% (${cap} টাকা) এর বেশি হতে পারবে না`);
    }
  }

  return {
    type,
    category,
    amount,
    installments,
    startMonth,
    issueDate,
    reason: String(body.reason || "").trim().slice(0, 500),
  };
};

// Approve এর মূল কাজ (create-with-approve ও আলাদা approve দুই জায়গা থেকে)
const approveLoan = async (loan, user, { note, startMonth, installments } = {}) => {
  if (loan.status !== "PENDING") throw fail(409, `এটি ইতোমধ্যে ${loan.status}`);
  if (!isApprover(user)) throw fail(403, "শুধু Accounts/Admin অনুমোদন দিতে পারবে");
  if (!cfg.ALLOW_SELF_APPROVAL && isOwner(loan, user)) {
    throw fail(403, "নিজের এন্ট্রি নিজে অনুমোদন করা যাবে না");
  }

  if (startMonth !== undefined && startMonth !== "") {
    if (!MONTH_RE.test(String(startMonth))) throw fail(400, "প্রথম কিস্তির মাস YYYY-MM ফরম্যাটে দিন");
    loan.startMonth = String(startMonth);
  }
  if (installments !== undefined && installments !== "") {
    const n = Math.floor(Number(installments));
    if (!Number.isFinite(n) || n < 1 || n > cfg.MAX_INSTALLMENTS) {
      throw fail(400, `কিস্তি ১ থেকে ${cfg.MAX_INSTALLMENTS} এর মধ্যে হতে হবে`);
    }
    loan.installments = n;
  }

  loan.schedule = buildSchedule(loan.amount, loan.installments, loan.startMonth);
  loan.status = "APPROVED";
  loan.decidedBy = user._id;
  loan.decidedByName = user.name;
  loan.decidedAt = new Date();
  loan.decisionNote = String(note || "").trim().slice(0, 300);
  await loan.save();

  // চলমান DRAFT পেরোল থাকলে সেখানে সাথে সাথে যোগ হবে
  await refreshDraftRunsForEmployee(loan.employee, loan.company);

  // প্রথম কিস্তির মাসের পেরোল আগেই Finalize/Paid হয়ে গেলে কিস্তি পরের পেরোলে যাবে
  const startRun = await PayrollRun.findOne({ company: loan.company, month: loan.startMonth }).select("status").lean();
  const late = startRun && startRun.status !== "DRAFT";
  return late
    ? `অনুমোদিত। ${loan.startMonth} মাসের পেরোল আগেই ${startRun.status}, তাই প্রথম কিস্তি পরের পেরোলে কাটা হবে।`
    : "অনুমোদিত। কিস্তি পেরোল শিটের Adv/Loan কলামে যুক্ত হবে।";
};

// GET /api/advances
exports.list = async (req, res, next) => {
  try {
    const { status, type, month, q } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));

    const filter = { company: req.companyId };
    if (status) filter.status = String(status).toUpperCase();
    if (type) filter.type = String(type).toUpperCase();
    if (month && MONTH_RE.test(month)) {
      filter.$or = [{ startMonth: month }, { "schedule.month": month }];
    }
    if (q && String(q).trim()) {
      const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      const search = [{ employeeId: rx }, { employeeName: rx }];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: search }];
        delete filter.$or;
      } else filter.$or = search;
    }

    const [total, rows, live] = await Promise.all([
      AdvanceLoan.countDocuments(filter),
      AdvanceLoan.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AdvanceLoan.find({ company: req.companyId, status: { $in: ["PENDING", "APPROVED", "CLOSED"] } })
        .select("status amount schedule")
        .lean(),
    ]);

    // সামারি (ফিল্টারের বাইরে, পুরো মডিউলের)
    const sumMonth = /^\d{4}-\d{2}$/.test(month || "") ? month : bdCurrentMonth();
    const summary = {
      pendingCount: 0, pendingAmount: 0, activeCount: 0, outstanding: 0, monthDeduction: 0, month: sumMonth,
    };
    for (const l of live) {
      if (l.status === "PENDING") {
        summary.pendingCount++;
        summary.pendingAmount += l.amount;
      }
      if (l.status === "APPROVED") {
        summary.activeCount++;
        summary.outstanding += l.amount - recoveredOf(l);
      }
      if (l.status !== "PENDING") {
        for (const s of l.schedule) if (s.month === sumMonth) summary.monthDeduction += s.amount;
      }
    }
    summary.pendingAmount = money2(summary.pendingAmount);
    summary.outstanding = money2(summary.outstanding);
    summary.monthDeduction = money2(summary.monthDeduction);

    res.json({
      success: true,
      data: rows.map(shape),
      summary,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    sendError(error, res, next);
  }
};

// GET /api/advances/:id
exports.getOne = async (req, res, next) => {
  try {
    const loan = await AdvanceLoan.findOne({ _id: req.params.id, company: req.companyId });
    if (!loan) throw fail(404, "রেকর্ড পাওয়া যায়নি");
    res.json({ success: true, data: shape(loan) });
  } catch (error) {
    sendError(error, res, next);
  }
};

// POST /api/advances   (ADMIN, HR, ACCOUNTS) — অনুমোদন ছাড়া PENDING; ACCOUNTS/ADMIN চাইলে approveNow
exports.create = async (req, res, next) => {
  try {
    const employee = await Employee.findOne({ _id: req.body.employee, company: req.companyId, isDeleted: { $ne: true } })
      .populate("department", "name")
      .lean();
    if (!employee) throw fail(404, "কর্মী পাওয়া যায়নি");
    if (employee.employmentStatus !== "Active") throw fail(400, "শুধু Active কর্মীর জন্য এন্ট্রি দেওয়া যাবে");

    const input = await validateInput(req.body, { employee });

    const loan = new AdvanceLoan({
      company: req.companyId,
      ...input,
      employee: employee._id,
      employeeId: employee.employeeId,
      employeeName: employee.name,
      department: employee.department?.name || "",
      section: employee.section || "",
      requestedBy: req.user._id,
      requestedByName: req.user.name,
      requestedByRole: req.user.role,
    });
    await loan.save();

    let message = "এন্ট্রি জমা হয়েছে — Accounts অনুমোদনের অপেক্ষায়";
    if (req.body.approveNow && isApprover(req.user)) {
      message = await approveLoan(loan, req.user, { note: req.body.note });
    }
    res.status(201).json({ success: true, message, data: shape(loan) });
  } catch (error) {
    sendError(error, res, next);
  }
};

// PUT /api/advances/:id  (শুধু PENDING; Admin/Accounts যেকোনোটা, HR শুধু নিজেরটা)
exports.update = async (req, res, next) => {
  try {
    const loan = await AdvanceLoan.findOne({ _id: req.params.id, company: req.companyId });
    if (!loan) throw fail(404, "রেকর্ড পাওয়া যায়নি");
    if (loan.status !== "PENDING") throw fail(409, "শুধু PENDING এন্ট্রি এডিট করা যায়");
    if (!isApprover(req.user) && !isOwner(loan, req.user)) throw fail(403, "আপনি শুধু নিজের এন্ট্রি এডিট করতে পারবেন");

    const employee = await Employee.findOne({ _id: loan.employee, company: req.companyId }).lean();
    const current = {
      ...loan.toObject(),
      issueDate: loan.issueDate ? loan.issueDate.toISOString().slice(0, 10) : null,
    };
    Object.assign(loan, await validateInput({ ...current, ...req.body }, { employee }));
    await loan.save();
    res.json({ success: true, message: "এন্ট্রি আপডেট হয়েছে", data: shape(loan) });
  } catch (error) {
    sendError(error, res, next);
  }
};

// PATCH /api/advances/:id/approve  (ADMIN, ACCOUNTS)
exports.approve = async (req, res, next) => {
  try {
    const loan = await AdvanceLoan.findOne({ _id: req.params.id, company: req.companyId });
    if (!loan) throw fail(404, "রেকর্ড পাওয়া যায়নি");
    const message = await approveLoan(loan, req.user, req.body || {});
    res.json({ success: true, message, data: shape(loan) });
  } catch (error) {
    sendError(error, res, next);
  }
};

// PATCH /api/advances/:id/reject  (ADMIN, ACCOUNTS)
exports.reject = async (req, res, next) => {
  try {
    const loan = await AdvanceLoan.findOne({ _id: req.params.id, company: req.companyId });
    if (!loan) throw fail(404, "রেকর্ড পাওয়া যায়নি");
    if (loan.status !== "PENDING") throw fail(409, `এটি ইতোমধ্যে ${loan.status}`);
    const note = String(req.body?.note || "").trim();
    if (!note) throw fail(400, "বাতিলের কারণ লিখুন");

    loan.status = "REJECTED";
    loan.decidedBy = req.user._id;
    loan.decidedByName = req.user.name;
    loan.decidedAt = new Date();
    loan.decisionNote = note.slice(0, 300);
    await loan.save();
    res.json({ success: true, message: "প্রত্যাখ্যান করা হয়েছে", data: shape(loan) });
  } catch (error) {
    sendError(error, res, next);
  }
};

// PATCH /api/advances/:id/cancel
//  PENDING  : নিজের এন্ট্রি (বা Admin/Accounts)
//  APPROVED : Admin/Accounts, যদি এখনো কোনো কিস্তি কাটা না হয়ে থাকে
exports.cancel = async (req, res, next) => {
  try {
    const loan = await AdvanceLoan.findOne({ _id: req.params.id, company: req.companyId });
    if (!loan) throw fail(404, "রেকর্ড পাওয়া যায়নি");

    if (loan.status === "PENDING") {
      if (!isApprover(req.user) && !isOwner(loan, req.user)) throw fail(403, "আপনি শুধু নিজের এন্ট্রি বাতিল করতে পারবেন");
    } else if (loan.status === "APPROVED") {
      if (!isApprover(req.user)) throw fail(403, "শুধু Accounts/Admin বাতিল করতে পারবে");
      if (loan.schedule.some((s) => s.deducted)) {
        throw fail(409, "কিস্তি ইতোমধ্যে কাটা হয়েছে — বাতিল নয়, 'Close' ব্যবহার করুন");
      }
    } else {
      throw fail(409, `${loan.status} অবস্থায় বাতিল করা যায় না`);
    }

    loan.status = "CANCELLED";
    loan.decisionNote = String(req.body?.note || loan.decisionNote || "").slice(0, 300);
    await loan.save();
    await refreshDraftRunsForEmployee(loan.employee, loan.company);
    res.json({ success: true, message: "বাতিল করা হয়েছে", data: shape(loan) });
  } catch (error) {
    sendError(error, res, next);
  }
};

// PATCH /api/advances/:id/close  (ADMIN, ACCOUNTS) — বাকি কিস্তি আর কাটা হবে না (নিষ্পত্তি/মওকুফ)
exports.close = async (req, res, next) => {
  try {
    const loan = await AdvanceLoan.findOne({ _id: req.params.id, company: req.companyId });
    if (!loan) throw fail(404, "রেকর্ড পাওয়া যায়নি");
    if (loan.status !== "APPROVED") throw fail(409, "শুধু চালু (APPROVED) রেকর্ড ক্লোজ করা যায়");
    const note = String(req.body?.note || "").trim();
    if (!note) throw fail(400, "ক্লোজের কারণ লিখুন (যেমন: নগদে পরিশোধ / মওকুফ)");

    loan.status = "CLOSED";
    loan.closedAt = new Date();
    loan.decisionNote = `${loan.decisionNote ? `${loan.decisionNote} | ` : ""}Closed: ${note}`.slice(0, 300);
    await loan.save();
    await refreshDraftRunsForEmployee(loan.employee, loan.company);
    res.json({ success: true, message: "ক্লোজ করা হয়েছে — বাকি কিস্তি আর কাটা হবে না", data: shape(loan) });
  } catch (error) {
    sendError(error, res, next);
  }
};

// DELETE /api/advances/:id
//  PENDING: নিজের (বা Admin/Accounts); REJECTED/CANCELLED: Admin। APPROVED/CLOSED কখনো নয় (আর্থিক রেকর্ড)।
exports.remove = async (req, res, next) => {
  try {
    const loan = await AdvanceLoan.findOne({ _id: req.params.id, company: req.companyId });
    if (!loan) throw fail(404, "রেকর্ড পাওয়া যায়নি");

    if (loan.status === "PENDING") {
      if (!isApprover(req.user) && !isOwner(loan, req.user)) throw fail(403, "আপনি শুধু নিজের এন্ট্রি মুছতে পারবেন");
    } else if (["REJECTED", "CANCELLED"].includes(loan.status)) {
      if (req.user.role !== "ADMIN") throw fail(403, "শুধু Admin মুছতে পারবে");
    } else {
      throw fail(409, "অনুমোদিত/ক্লোজ রেকর্ড মোছা যায় না");
    }

    await loan.deleteOne();
    res.json({ success: true, message: "মুছে ফেলা হয়েছে" });
  } catch (error) {
    sendError(error, res, next);
  }
};
