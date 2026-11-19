const METHOD_MAP = Object.freeze({
  Bkash: "BKASH",
  Bank: "BANK",
  Cash: "CASH",
});

/**
 * Build idempotent PaymentRecord upserts for a paid payroll run.
 * HOLD lines are deliberately excluded because they are not disbursed.
 */
const buildPayrollPaymentOperations = (run, lines, paidAt, userId) => {
  const operations = [];

  for (const line of lines) {
    const method = METHOD_MAP[line.method];
    const amount = Number(line.netPayable || 0);

    if (!method || !Number.isFinite(amount) || amount <= 0 || !line.employee) {
      continue;
    }

    const filter = {
      company: run.company,
      payrollRun: run._id,
      employee: line.employee,
    };

    operations.push({
      updateOne: {
        filter,
        update: {
          $setOnInsert: {
            ...filter,
            month: run.month,
            employeeId: line.employeeId || "",
            employeeName: line.name || "Unknown Employee",
            amount,
            method,
            accountNumber: line.accountNumber || "",
            transactionRef: "",
            paidAt,
            note: `Generated automatically from payroll ${run.month}`,
            createdBy: userId,
          },
        },
        upsert: true,
      },
    });
  }

  return operations;
};

const createPayrollPaymentRecords = async (run, userId, paidAt = new Date()) => {
  // Lazy-load Mongoose models so the pure mapping helper can be unit-tested without a DB.
  const PaymentRecord = require("../models/PaymentRecord");
  const { PayrollLine } = require("../models/Payroll");
  const lines = await PayrollLine.find({ company: run.company, run: run._id })
    .select("employee employeeId name netPayable method accountNumber")
    .lean();
  const operations = buildPayrollPaymentOperations(run, lines, paidAt, userId);

  if (!operations.length) return { createdOrExisting: 0, skipped: lines.length };

  // Unique company+payrollRun+employee index makes retries safe after a partial failure.
  const result = await PaymentRecord.bulkWrite(operations, { ordered: true });
  return {
    createdOrExisting: (result.upsertedCount || 0) + (result.matchedCount || 0),
    skipped: lines.length - operations.length,
  };
};

module.exports = { METHOD_MAP, buildPayrollPaymentOperations, createPayrollPaymentRecords };
