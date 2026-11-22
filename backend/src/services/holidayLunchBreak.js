// শুক্রবার / ঘোষিত হলিডেতে কাজ করলে লাঞ্চ ব্রেক (ডিফল্ট ৬০ মিনিট) OT থেকে কাটার নিয়ম।
//
// নিয়ম:
//  1) সকাল থেকে বিকাল/রাত পর্যন্ত কাজ করলে (লাঞ্চ টাইম পার হলে) -> ৬০ মিনিট কাটা যাবে, OT-তে যোগ হবে না।
//  2) সকাল থেকে দুপুর ২টা (LUNCH_CUTOFF) পর্যন্ত কাজ করলে -> লাঞ্চ কাটা হবে না।
//  3) নাইট শিফটে কাজ করলে -> কোনো ব্রেক কাটা হবে না।
//
// .env এ বদলানো যায়: HOLIDAY_LUNCH_BREAK_MINUTES (ডিফল্ট 60), HOLIDAY_LUNCH_CUTOFF_TIME (ডিফল্ট 14:00)

const numEnv = (raw, d) => {
  const n = Number(raw);
  return raw !== undefined && raw !== "" && Number.isFinite(n) && n >= 0 ? n : d;
};

const HOLIDAY_LUNCH_BREAK_MINUTES = numEnv(process.env.HOLIDAY_LUNCH_BREAK_MINUTES, 60);
const HOLIDAY_LUNCH_CUTOFF_TIME = process.env.HOLIDAY_LUNCH_CUTOFF_TIME || "14:00";

/**
 * @param {Object} p
 * @param {Date}    p.firstIn      প্রথম পাঞ্চ
 * @param {Date}    p.lastOut      শেষ পাঞ্চ
 * @param {Date}    p.cutoff       ঐ দিনের লাঞ্চ কাটঅফ সময় (দুপুর ২টা, UTC Date)
 * @param {boolean} p.isNight      নাইট শিফট কি না
 * @param {number}  [p.lunchMinutes]
 * @returns {number} যত মিনিট কাটতে হবে
 */
const getHolidayLunchDeduction = ({ firstIn, lastOut, cutoff, isNight, lunchMinutes = HOLIDAY_LUNCH_BREAK_MINUTES }) => {
  if (isNight) return 0;
  if (!firstIn || !lastOut || !cutoff) return 0;
  // লাঞ্চ টাইম পার করে কাজ করেছে এবং লাঞ্চের আগে থেকে কাজে ছিল
  if (firstIn < cutoff && lastOut > cutoff) return lunchMinutes;
  return 0;
};

module.exports = { getHolidayLunchDeduction, HOLIDAY_LUNCH_BREAK_MINUTES, HOLIDAY_LUNCH_CUTOFF_TIME };
