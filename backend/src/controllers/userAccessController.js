const mongoose=require("mongoose");
const User=require("../models/User");
const Company=require("../models/Company");
const {writeAudit}=require("../services/auditService");
exports.updateUserAccess=async(req,res,next)=>{try{const {companyAccess=[],defaultCompany=null}=req.body||{};if(!Array.isArray(companyAccess)||companyAccess.some(id=>!mongoose.isValidObjectId(id)))return res.status(400).json({success:false,message:"companyAccess must be an array of valid company IDs"});const ids=[...new Set(companyAccess.map(String))];const found=await Company.countDocuments({_id:{$in:ids},isActive:true});if(found!==ids.length)return res.status(400).json({success:false,message:"One or more companies are invalid or inactive"});if(defaultCompany&&!ids.includes(String(defaultCompany)))return res.status(400).json({success:false,message:"Default company must be included in companyAccess"});const user=await User.findById(req.params.id);if(!user)return res.status(404).json({success:false,message:"User not found"});if(user.role==="ADMIN")return res.status(400).json({success:false,message:"Group Admin already has access to all companies"});user.companyAccess=ids;user.defaultCompany=defaultCompany||ids[0]||null;await user.save();await writeAudit(req,{action:"UPDATE_COMPANY_ACCESS",module:"USER",targetId:user._id,details:{companyAccess:ids,defaultCompany:user.defaultCompany}});res.json({success:true,user:user.toSafeJSON()});}catch(e){next(e);}};

// GET /api/users/punch-employees?company=<id>&search=  (ADMIN) — SECURITY ইউজারকে কর্মী বাছাইয়ের জন্য হালকা তালিকা
exports.listPunchEmployees=async(req,res,next)=>{try{
  const Employee=require("../models/Employee");
  const {company,search}=req.query;
  if(!company||!mongoose.isValidObjectId(company))return res.status(400).json({success:false,message:"company is required"});
  const filter={company,isDeleted:{$ne:true},employmentStatus:"Active"};
  if(search){const q=String(search).trim().split("").map(c=>"\\^$.*+?()[]{}|".includes(c)?"\\"+c:c).join("");filter.$or=[{name:new RegExp(q,"i")},{nameBangla:new RegExp(q,"i")},{employeeId:new RegExp(q,"i")}];}
  const employees=await Employee.find(filter).select("name nameBangla employeeId section").sort({employeeId:1}).limit(1000).lean();
  res.json({success:true,employees});
}catch(e){next(e);}};
