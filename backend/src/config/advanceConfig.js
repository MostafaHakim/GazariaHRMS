// Advance & Loan মডিউলের নিয়ম। বদলাতে হলে এখানে বা .env এ বদলান।
const num = (v, d) => (v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : d);

module.exports = {
  TYPES: ["ADVANCE", "LOAN"],
  CATEGORIES: ["SALARY_ADVANCE", "MEDICAL", "EMERGENCY", "FESTIVAL", "HOUSING", "EDUCATION", "PERSONAL", "OTHER"],
  STATUSES: ["PENDING", "APPROVED", "REJECTED", "CANCELLED", "CLOSED"],

  // এন্ট্রি দিতে পারবে / অনুমোদন দিতে পারবে
  ENTRY_ROLES: ["ADMIN", "HR", "ACCOUNTS"],
  APPROVER_ROLES: ["ADMIN", "ACCOUNTS"],

  // false হলে যে এন্ট্রি দিয়েছে সে নিজেরটা অনুমোদন করতে পারবে না (ADVANCE_ALLOW_SELF_APPROVAL=false)
  ALLOW_SELF_APPROVAL: process.env.ADVANCE_ALLOW_SELF_APPROVAL !== "false",

  MAX_INSTALLMENTS: num(process.env.ADVANCE_MAX_INSTALLMENTS, 36),
  MAX_AMOUNT: num(process.env.ADVANCE_MAX_AMOUNT, 10000000),
  // শুধু ADVANCE টাইপ: কর্মীর বেতনের এত শতাংশের বেশি অ্যাডভান্স নয় (0 = সীমা বন্ধ)
  ADVANCE_MAX_PERCENT_OF_SALARY: num(process.env.ADVANCE_MAX_PERCENT_OF_SALARY, 0),
};
