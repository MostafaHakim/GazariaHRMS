require("dotenv").config();
const mongoose=require("mongoose");
const connectDB=require("../config/db");
const Expense=require("../models/Expense");
const PaymentRecord=require("../models/PaymentRecord");
const AuditLog=require("../models/AuditLog");
(async()=>{try{await connectDB();await Promise.all([Expense.createIndexes(),PaymentRecord.createIndexes(),AuditLog.createIndexes()]);console.log("Phase 7 indexes prepared");await mongoose.disconnect();}catch(e){console.error(e);process.exit(1);}})();
