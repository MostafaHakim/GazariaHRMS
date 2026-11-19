const Expense = require("../models/Expense");
const PaymentRecord = require("../models/PaymentRecord");
const AuditLog = require("../models/AuditLog");
const { writeAudit } = require("../services/auditService");

exports.listExpenses = async (req, res, next) => { try { const q = { company: req.companyId }; if (req.query.from || req.query.to) q.date = {}; if (req.query.from) q.date.$gte = new Date(req.query.from); if (req.query.to) q.date.$lte = new Date(req.query.to); const rows = await Expense.find(q).sort({ date: -1, createdAt: -1 }).lean(); res.json({ success: true, expenses: rows }); } catch(e){next(e);} };
exports.createExpense = async (req, res, next) => { try {
 const { date, category, description, amount, paymentMethod, reference } = req.body || {};
 if (!date || Number.isNaN(new Date(date).getTime()) || !String(category || "").trim() || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return res.status(400).json({success:false,message:"Valid date, category and positive amount are required"});
 if (paymentMethod && !["CASH","BANK","BKASH","OTHER"].includes(paymentMethod)) return res.status(400).json({success:false,message:"Invalid expense payment method"});
 const row = await Expense.create({ company:req.companyId, date:new Date(date), category, description, amount:Number(amount), paymentMethod, reference, createdBy:req.user._id });
 await writeAudit(req,{action:"CREATE",module:"EXPENSE",targetId:row._id,details:{amount:row.amount,category:row.category}});
 res.status(201).json({success:true,expense:row});
 } catch(e){next(e);} };
exports.updateExpense = async (req,res,next)=>{ try {
  const body = req.body || {};
  if (body.amount !== undefined && (!Number.isFinite(Number(body.amount)) || Number(body.amount) <= 0)) return res.status(400).json({success:false,message:"Amount must be a positive number"});
  if (body.date !== undefined && Number.isNaN(new Date(body.date).getTime())) return res.status(400).json({success:false,message:"A valid expense date is required"});
  if (body.status !== undefined && !["RECORDED","VOID"].includes(body.status)) return res.status(400).json({success:false,message:"Invalid expense status"});
  if (body.paymentMethod !== undefined && !["CASH","BANK","BKASH","OTHER"].includes(body.paymentMethod)) return res.status(400).json({success:false,message:"Invalid expense payment method"});
  const row=await Expense.findOne({ _id:req.params.id, company:req.companyId });
  if(!row) return res.status(404).json({success:false,message:"Expense not found"});
  for(const k of ["date","category","description","amount","paymentMethod","reference","status"]) if(body[k]!==undefined) row[k]=k==="amount"?Number(body[k]):body[k];
  row.updatedBy=req.user._id; await row.save();
  await writeAudit(req,{action:"UPDATE",module:"EXPENSE",targetId:row._id,details:{changed:Object.keys(body)}});
  res.json({success:true,expense:row});
 }catch(e){next(e);} };
exports.listPayments = async (req,res,next)=>{try{const q={company:req.companyId}; if(req.query.month) q.month=req.query.month; const rows=await PaymentRecord.find(q).sort({paidAt:-1}).limit(Math.min(Number(req.query.limit)||500,1000)).lean(); res.json({success:true,payments:rows});}catch(e){next(e);}};
exports.createPayment = async (req,res,next)=>{try{
 const {month,employee,employeeId,employeeName,amount,method,accountNumber,transactionRef,paidAt,note}=req.body||{};
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||"")||!employeeName||!Number.isFinite(Number(amount))||Number(amount)<=0||!["BKASH","BANK","CASH","OTHER"].includes(method)) return res.status(400).json({success:false,message:"Valid month, employee name, positive amount and method are required"});
 if (paidAt && Number.isNaN(new Date(paidAt).getTime())) return res.status(400).json({success:false,message:"Invalid payment date"});
 const Employee = require("../models/Employee");
 let employeeRef = employee || null;
 if (employeeRef) {
   const found = await Employee.findOne({ _id: employeeRef, company: req.companyId }).select("_id").lean();
   if (!found) return res.status(400).json({success:false,message:"Employee does not belong to the selected company"});
 } else if (employeeId) {
   const found = await Employee.findOne({ employeeId: String(employeeId).trim().toUpperCase(), company: req.companyId }).select("_id").lean();
   if (!found) return res.status(400).json({success:false,message:"Employee ID was not found in the selected company"});
   employeeRef = found._id;
 }
 const row=await PaymentRecord.create({company:req.companyId,month,employee:employeeRef,employeeId,employeeName,amount:Number(amount),method,accountNumber,transactionRef,paidAt:paidAt?new Date(paidAt):new Date(),note,createdBy:req.user._id});
 await writeAudit(req,{action:"CREATE",module:"PAYMENT",targetId:row._id,details:{month,amount:row.amount,method}});
 res.status(201).json({success:true,payment:row});
 }catch(e){next(e);}};
exports.listAudit = async(req,res,next)=>{try{
 const q = req.user.role === "ADMIN" ? { $or: [{ company: req.companyId }, { company: null }] } : { company: req.companyId };
 if(req.query.module) q.module=req.query.module;
 const rows=await AuditLog.find(q).populate("actor","name username").sort({createdAt:-1}).limit(Math.min(Number(req.query.limit)||200,500)).lean();
 res.json({success:true,logs:rows});
 }catch(e){next(e);}};
exports.groupDashboard = async(req,res,next)=>{try{if(req.user.role!=="ADMIN")return res.status(403).json({success:false,message:"Group Admin only"}); const Company=require("../models/Company"); const Employee=require("../models/Employee"); const {PayrollRun,PayrollLine}=require("../models/Payroll"); const Expense=require("../models/Expense"); const companies=await Company.find({isActive:true}).select("name code").lean(); const result=await Promise.all(companies.map(async c=>{const [employees,payroll,expense]=await Promise.all([Employee.countDocuments({company:c._id,isDeleted:false,employmentStatus:"Active"}),PayrollRun.findOne({company:c._id,month:req.query.month}).lean(),Expense.aggregate([{$match:{company:c._id,status:"RECORDED",...(req.query.month?{date:{$gte:new Date(req.query.month+"-01"),$lt:new Date(new Date(req.query.month+"-01").getFullYear(),new Date(req.query.month+"-01").getMonth()+1,1)}}:{})}},{$group:{_id:null,total:{$sum:"$amount"}}}])]); let payrollSummary=null;if(payroll){const sums=await PayrollLine.aggregate([{$match:{company:c._id,run:payroll._id}},{$group:{_id:null,netPayable:{$sum:"$netPayable"},employees:{$sum:1}}}]);payrollSummary={status:payroll.status,...(sums[0]||{netPayable:0,employees:0})};}return{company:c,employees,payroll:payrollSummary,expenses:expense[0]?.total||0};}));res.json({success:true,month:req.query.month||null,companies:result,totals:result.reduce((a,x)=>({employees:a.employees+x.employees,payroll:a.payroll+(x.payroll?.netPayable||0),expenses:a.expenses+x.expenses}),{employees:0,payroll:0,expenses:0})});}catch(e){next(e);}};
