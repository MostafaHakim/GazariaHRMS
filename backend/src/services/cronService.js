const cron = require("node-cron");
const {
  calculateDailyAttendance,
} = require("./attendanceCalculationService");

// সব কোম্পানির enabled PULL ডিভাইস sync (ADMS ডিভাইস নিজেই push করে)
const runDeviceSync = async (options = {}) => {
  const { syncPullDevice } = require("./deviceSyncService");
  const Device = require("../models/Device");
  const Company = require("../models/Company");
  const devices = await Device.find({ enabled: true, protocol: "PULL" }).lean();

  const results = [];
  for (const device of devices) {
    const r = await syncPullDevice(device);
    if (r.status === "Failed") console.error(`[CRON] Sync failed ${device.name}:`, r.error);
    results.push({ deviceId: device.deviceId, status: r.status, insertedRecords: r.insertedRecords || 0 });
  }

  // Auto calculate: গতকাল + আজ (BD)
  // গতকাল ধরা হয় কারণ নাইট শিফট (যেমন ২০:০০ → ০৫:০০) পরের দিন সকালে শেষ হয়;
  // সকালের Out পাঞ্চ ঢুকলে গতকালের রেকর্ড পূর্ণ হয়ে যাবে।
  // Manual edit করা রেকর্ড calculate ছোঁয় না (isManuallyEdited)।
  if (options.calculate !== false) {
    const dates = [getBdDateString(-1), getBdDateString(0)];
    const companies = await Company.find({ isActive: true }).select("_id").lean();
    for (const date of dates) for (const company of companies) {
      try {
        const calc = await calculateDailyAttendance(date, { companyId: company._id });
        console.log(`[CRON] Daily calculate ${date} company=${company._id}: processed=${calc.processed}`);
      } catch (err) {
        console.error(`[CRON] Calculate failed ${date} company=${company._id}:`, err.message);
      }
    }
  }

  return results;
};

const getBdDateString = (offsetDays = 0) => {
  const now = new Date();
  const bd = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  bd.setUTCDate(bd.getUTCDate() + offsetDays);
  return bd.toISOString().slice(0, 10);
};

const startCronJobs = () => {
  // Every 30 minutes: device sync + calculate today
  // Asia/Dhaka timezone
  cron.schedule(
    "*/30 * * * *",
    async () => {
      console.log("[CRON] Starting scheduled device sync...");
      try {
        await runDeviceSync({ calculate: true });
        console.log("[CRON] Scheduled sync finished");
      } catch (err) {
        console.error("[CRON] Scheduled sync error:", err.message);
      }
    },
    { timezone: "Asia/Dhaka" },
  );

  // Every day at 00:15 BD — generate-ready: calculate yesterday (night shifts)
  cron.schedule(
    "15 0 * * *",
    async () => {
      const yesterday = getBdDateString(-1);
      const Company = require("../models/Company");
      const companies = await Company.find({ isActive: true }).select("_id").lean();
      for (const company of companies) {
        try { await calculateDailyAttendance(yesterday, { companyId: company._id }); }
        catch (err) { console.error(`[CRON] Yesterday calculate failed company=${company._id}:`, err.message); }
      }
    },
    { timezone: "Asia/Dhaka" },
  );

  // Every Saturday 00:05 BD — চলতি সপ্তাহের Roster আছে কিনা যাচাই (বছরের Roster আগেই বানানো থাকার কথা)
  cron.schedule(
    "5 0 * * 6",
    async () => {
      try {
        const WeeklyRoster = require("../models/WeeklyRoster");
        const { getSaturday } = require("./rosterService");
        const week = getSaturday(new Date(Date.now() + 6 * 60 * 60 * 1000));
        const exists = await WeeklyRoster.exists({ weekStartDate: week });
        if (!exists) {
          console.warn("[CRON] এই সপ্তাহের Roster নেই! Roster Plan পেজ থেকে আগামী সময়ের Roster Generate করুন।");
        }
      } catch (err) {
        console.error("[CRON] Roster check failed:", err.message);
      }
    },
    { timezone: "Asia/Dhaka" },
  );

  console.log(
    "[CRON] Jobs registered: sync every 30min, calculate yesterday at 00:15, Saturday reminder",
  );
};

module.exports = {
  startCronJobs,
  runDeviceSync,
};
