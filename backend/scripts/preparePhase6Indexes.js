const mongoose = require("mongoose");
require("dotenv").config();

const run = async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error("MONGODB_URI/MONGO_URI missing in .env");
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  // New company-scoped unique indexes. Existing legacy records without company are
  // intentionally retained and excluded from new company payroll/advance queries.
  await db.collection("payrollruns").dropIndex("month_1").catch((e) => { if (e.codeName !== "IndexNotFound") throw e; });
  await db.collection("payrollruns").createIndex({ company: 1, month: 1 }, { unique: true, name: "company_payroll_month_unique" });
  await db.collection("advanceloans").createIndex({ company: 1, employee: 1, status: 1 }, { name: "company_1_employee_1_status_1" });
  await db.collection("advanceloans").createIndex({ company: 1, status: 1, startMonth: 1 }, { name: "company_1_status_1_startMonth_1" });
  console.log("Phase 6 indexes prepared. Legacy records were not migrated or deleted.");
  await mongoose.disconnect();
};
run().catch(async (e) => { console.error(e); await mongoose.disconnect().catch(() => {}); process.exit(1); });
