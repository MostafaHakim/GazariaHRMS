const test = require("node:test");
const assert = require("node:assert/strict");
const { buildPayrollPaymentOperations } = require("../services/payrollPaymentService");

const run = {
  _id: "64a000000000000000000001",
  company: "64a000000000000000000002",
  month: "2026-10",
};
const paidAt = new Date("2026-11-01T10:00:00.000Z");
const userId = "64a000000000000000000003";

test("creates company/run/employee-scoped upserts for payable methods", () => {
  const lines = [
    { employee: "64a000000000000000000011", employeeId: "E-01", name: "A", netPayable: 12000, method: "Bkash", accountNumber: "01700000000" },
    { employee: "64a000000000000000000012", employeeId: "E-02", name: "B", netPayable: 15000, method: "Bank", accountNumber: "123" },
    { employee: "64a000000000000000000013", employeeId: "E-03", name: "C", netPayable: 9000, method: "Cash" },
  ];
  const ops = buildPayrollPaymentOperations(run, lines, paidAt, userId);
  assert.equal(ops.length, 3);
  assert.deepEqual(ops.map(x => x.updateOne.update.$setOnInsert.method), ["BKASH", "BANK", "CASH"]);
  assert.equal(ops[0].updateOne.filter.company, run.company);
  assert.equal(ops[0].updateOne.filter.payrollRun, run._id);
  assert.equal(ops[0].updateOne.filter.employee, lines[0].employee);
  assert.equal(ops[0].updateOne.update.$setOnInsert.amount, 12000);
  assert.equal(ops[0].updateOne.upsert, true);
});

test("skips HOLD, zero/negative, invalid amount, and missing employee lines", () => {
  const lines = [
    { employee: "1", name: "Hold", netPayable: 100, method: "Hold" },
    { employee: "2", name: "Zero", netPayable: 0, method: "Cash" },
    { employee: "3", name: "Negative", netPayable: -5, method: "Bank" },
    { employee: "4", name: "Bad", netPayable: "abc", method: "Bkash" },
    { name: "No employee", netPayable: 100, method: "Cash" },
  ];
  assert.deepEqual(buildPayrollPaymentOperations(run, lines, paidAt, userId), []);
});

test("does not create a payment for an unknown method", () => {
  const lines = [{ employee: "1", name: "Unknown", netPayable: 100, method: "Cheque" }];
  assert.deepEqual(buildPayrollPaymentOperations(run, lines, paidAt, userId), []);
});

const { canAccessCompany } = require("../utils/companyAccess");

test("Group Admin can access any selected active company context", () => {
  assert.equal(canAccessCompany({ role: "ADMIN", companyAccess: [] }, "company-b"), true);
});

test("HR can access only explicitly assigned companies", () => {
  const user = { role: "HR", companyAccess: ["company-a", "company-c"] };
  assert.equal(canAccessCompany(user, "company-a"), true);
  assert.equal(canAccessCompany(user, "company-b"), false);
});

test("missing user or company is never authorized", () => {
  assert.equal(canAccessCompany(null, "company-a"), false);
  assert.equal(canAccessCompany({ role: "ADMIN" }, ""), false);
});
