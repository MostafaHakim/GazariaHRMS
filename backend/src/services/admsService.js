const AttendanceLog = require('../models/AttendanceLog');
const DeviceSyncLog = require('../models/DeviceSyncLog');
const Device = require('../models/Device');
const BD_OFFSET_HOURS = 6;

const findAdmsDevice = async (serialNumber) => {
  if (!serialNumber) return null;
  return Device.findOne({serialNumber:String(serialNumber).trim(),protocol:'ADMS',enabled:true}).lean();
};
const parseDeviceDateTime = (value) => {
  const match=String(value||'').trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})[ T](\d{1,2}):(\d{2}):(\d{2})$/);
  if(!match) return null;
  const [,y,m,d,h,mi,s]=match;
  const date=new Date(Date.UTC(+y,+m-1,+d,+h-BD_OFFSET_HOURS,+mi,+s));
  return Number.isNaN(date.getTime())?null:date;
};
const parseAttLogLine=(line)=>{
  const columns=String(line).trim().split('\t').map(v=>v.trim());
  if(columns.length<2) return null;
  let pin=columns[0]||''; const pm=pin.match(/^(?:PIN|USERID|EnrollNumber)\s*=\s*(.+)$/i); if(pm) pin=pm[1].trim();
  const recordTime=parseDeviceDateTime(columns[1]); if(!pin||!recordTime) return null;
  return {deviceUserId:pin,recordTime,verifyMode:columns[2]??'',inOutStatus:columns[3]??'',workCode:columns[4]??'',columns};
};
const saveAttendancePush=async({device,sourceIp,body})=>{
  const lines=String(body||'').replace(/^\uFEFF/,'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const parsed=lines.map(parseAttLogLine); const valid=parsed.filter(Boolean); const invalid=parsed.length-valid.length;
  let inserted=0,duplicates=0;
  if(valid.length){
    const operations=valid.map(r=>({updateOne:{filter:{company:device.company,deviceId:device.deviceId,userSn:'',deviceUserId:r.deviceUserId,recordTime:r.recordTime},update:{$setOnInsert:{company:device.company,deviceId:device.deviceId,deviceIp:device.ip||sourceIp||'',userSn:'',deviceUserId:r.deviceUserId,recordTime:r.recordTime,sourceIp:sourceIp||'',rawData:{protocol:'ADMS',serialNumber:device.serialNumber,verifyMode:r.verifyMode,inOutStatus:r.inOutStatus,workCode:r.workCode,columns:r.columns}}},upsert:true}}));
    try{const result=await AttendanceLog.bulkWrite(operations,{ordered:false});inserted=result.upsertedCount||0;duplicates=valid.length-inserted;}
    catch(e){if(e.code!==11000&&!e.writeErrors?.some(x=>x.code===11000)) throw e;inserted=e.result?.upsertedCount||0;duplicates=Math.max(0,valid.length-inserted);}
  }
  await DeviceSyncLog.create({company:device.company,deviceId:device.deviceId,deviceName:device.name,deviceIp:device.ip||sourceIp||'',status:invalid?'Partial':'Success',totalRecords:lines.length,insertedRecords:inserted,duplicateRecords:duplicates,errorMessage:invalid?`${invalid} invalid ADMS record(s) skipped`:'ADMS push received',startedAt:new Date(),completedAt:new Date()});
  return {received:lines.length,valid:valid.length,inserted,duplicates,invalid};
};
module.exports={findAdmsDevice,saveAttendancePush};
