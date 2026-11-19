require('dotenv').config();
const mongoose=require('mongoose');
const Shift=require('../src/models/Shift');
const AttendanceLog=require('../src/models/AttendanceLog');
const DeviceSyncLog=require('../src/models/DeviceSyncLog');
const DailyAttendance=require('../src/models/DailyAttendance');
(async()=>{
 try{
  if(!process.env.MONGODB_URI&&!process.env.MONGO_URI) throw new Error('MONGODB_URI/MONGO_URI missing in .env');
  await mongoose.connect(process.env.MONGODB_URI||process.env.MONGO_URI);
  const shiftIndexes=await Shift.collection.indexes();
  for(const ix of shiftIndexes) if(ix.name==='code_1') await Shift.collection.dropIndex(ix.name);
  const logIndexes=await AttendanceLog.collection.indexes();
  for(const ix of logIndexes) if(ix.name==='unique_device_attendance_log') await AttendanceLog.collection.dropIndex(ix.name);
  await Shift.collection.createIndex({company:1,code:1},{unique:true,name:'company_shift_code_unique'});
  await AttendanceLog.collection.createIndex({company:1,deviceId:1,userSn:1,deviceUserId:1,recordTime:1},{unique:true,name:'unique_company_device_attendance_log'});
  await AttendanceLog.collection.createIndex({company:1,recordTime:-1});
  await DeviceSyncLog.collection.createIndex({company:1,deviceId:1,createdAt:-1});
  await DailyAttendance.collection.createIndex({company:1,employee:1,attendanceDate:1},{unique:true,name:'company_employee_attendance_date_unique'});
  console.log('Phase 4 indexes prepared. No business records were deleted.');
 }catch(e){console.error('Phase 4 index preparation failed:',e.message);process.exitCode=1;}
 finally{await mongoose.disconnect();}
})();
