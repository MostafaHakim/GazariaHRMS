// পেরোল শিটের (Oct 2026) ফর্মুলার হুবহু নিয়ম। বদলাতে হলে এখানেই বদলান।
const num = (v, d) => (v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : d);

module.exports = {
  // Day OT/ঘণ্টা  = Basic / (MonthDays * 12)
  OT_DAY_DIVISOR: num(process.env.PAYROLL_OT_DAY_DIVISOR, 12),
  // Night OT/ঘণ্টা = Basic / (MonthDays * 10)
  OT_NIGHT_DIVISOR: num(process.env.PAYROLL_OT_NIGHT_DIVISOR, 10),
  // OT 20% = OT Amount * 20%
  OT_EXTRA_RATE: num(process.env.PAYROLL_OT_EXTRA_RATE, 0.2),
  // Night Allowance = Night দিন * 15
  NIGHT_ALLOWANCE_PER_NIGHT: num(process.env.PAYROLL_NIGHT_ALLOWANCE, 15),
  // Late এত দিনের বেশি হলে হাজিরা বোনাস নেই (শিটে J>2)
  ATT_BONUS_MAX_LATE_DAYS: num(process.env.PAYROLL_BONUS_MAX_LATE, 2),
  // শিটে "Basic Salary" কলামে Employee এর কোন ফিল্ড ধরা হবে: "basicSalary" | "grossSalary"
  SALARY_FIELD: process.env.PAYROLL_SALARY_FIELD === "grossSalary" ? "grossSalary" : "basicSalary",
  // একটি মাত্র পাঞ্চ (INCOMPLETE) থাকা দিন Absent ধরা হবে কি না (ডিফল্ট: হ্যাঁ, HR ঠিক না করা পর্যন্ত)
  INCOMPLETE_AS_ABSENT: process.env.PAYROLL_INCOMPLETE_AS_ABSENT !== "false",
  // UNPAID ধরনের ছুটি বেতন কাটবে (Absent হিসেবে গণ্য)
  UNPAID_LEAVE_AS_ABSENT: true,
  // স্যান্ডউইচ নিয়ম: বৃহস্পতিবার বা শনিবার Absent থাকলে শুক্রবারও Absent গণ্য (সাপ্তাহিক ছুটির বেতন নেই)।
  // শুক্রবার কাজ করলে (২+ পাঞ্চ বা OT) এই নিয়ম খাটে না। বন্ধ করতে .env এ PAYROLL_FRIDAY_SANDWICH=false
  // হলিডে স্যান্ডউইচ: হলিডের (বা টানা ছুটির) আগের কর্মদিবস ও পরের কর্মদিবস দুটোই Absent হলে ওই হলিডে Absent গণ্য।
  // বন্ধ করতে .env এ PAYROLL_HOLIDAY_SANDWICH=false
  HOLIDAY_SANDWICH_ABSENT: process.env.PAYROLL_HOLIDAY_SANDWICH !== "false",
  HOLIDAY_SCAN_DAYS: 10, // টানা ছুটি (ঈদ ইত্যাদি) পার হয়ে কর্মদিবস খুঁজতে কত দিন আগে/পরে দেখবে
  FRIDAY_SANDWICH_ABSENT: process.env.PAYROLL_FRIDAY_SANDWICH !== "false",

  // শিটে এই ডিপার্টমেন্টগুলোর Att. Bonus ঘরে হাতে 0 বসানো (ফর্মুলা নেই) — তাই বোনাস পায় না
  BONUS_EXCLUDED_DEPARTMENTS: (process.env.PAYROLL_BONUS_EXCLUDED || "Floor Staff,Security,Delivery,Driver")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  // শিটে Driver এর OT 20% ঘরে হাতে 0 বসানো (OT Amount থাকা সত্ত্বেও)
  OT20_EXCLUDED_DEPARTMENTS: (process.env.PAYROLL_OT20_EXCLUDED || "Driver")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),

  // এই সেকশনের (Employee.section) কর্মীদের OT নেই: বাড়তি ডিউটি, শুক্রবার বা হলিডেতে কাজ করলেও OT গণনা হয় না।
  // বড়/ছোট হাতের তফাত ও বাড়তি স্পেস উপেক্ষা করা হয়। .env এ PAYROLL_OT_EXCLUDED_SECTIONS দিয়ে বদলানো যায় (কমা দিয়ে আলাদা)।
  OT_EXCLUDED_SECTIONS: (process.env.PAYROLL_OT_EXCLUDED_SECTIONS || "Staff,Floor Staff")
    .split(",").map((x) => x.trim().toLowerCase()).filter(Boolean),

  METHODS: ["Bkash", "Bank", "Cash", "Hold"],
  // শিটের মতো ডিপার্টমেন্ট ক্রম (বাকিগুলো নামের ক্রমে শেষে)
  DEPARTMENT_ORDER: [
    "Needle", "Crochet", "Jacquard", "Warping", "Covering", "Finishing", "Clenning",
    "Swing Thread", "Loader", "Coning", "Floor Staff", "Electrical", "Security", "Delivery", "Driver",
  ],
};
