require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const PaymentRecord = require("../models/PaymentRecord");

(async () => {
  try {
    await connectDB();
    await PaymentRecord.createIndexes();
    console.log("Phase 8 payroll payment indexes prepared");
    await mongoose.disconnect();
  } catch (error) {
    console.error("Phase 8 index preparation failed:", error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
})();
