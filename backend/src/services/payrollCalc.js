const cfg = require("../config/payrollConfig");

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// শিটের কলাম-ফর্মুলা, ঠিক যেভাবে Excel এ আছে:
//  G Present      = F-(H+I+K)
//  M Payable Days = G+K+I
//  O Salary Pay   = ROUND(N/F*M)
//  R OT Hours     = P+Q
//  S OT Amount    = N/(F*10)*Q + N/(F*12)*P
//  T OT 20%       = S*20%
//  U Att. Bonus   = IF(H>0,0,IF(I>0,0,IF(J>2,0,N/F)))
//  V Night Allow. = L*15
//  Z Net Payable  = ROUND(O+S+T+U+V+W-(Y+X))   (Y = Advance + Loan/Adv. কিস্তি)
// `present` ইনপুট নয়, সবসময় এই ফর্মুলায় বের হয়।
const computeLine = (input) => {
  const monthDays = n(input.monthDays);
  const absent = n(input.absent);
  const leave = n(input.leave);
  const late = n(input.late);
  const whDays = n(input.whDays);
  const night = n(input.night);
  const basic = n(input.basicSalary);
  const otDay = n(input.otDayHours);
  const otNight = n(input.otNightHours);

  const present = Math.max(0, monthDays - (absent + leave + whDays));
  const payableDays = present + whDays + leave;
  const salaryPayable = monthDays > 0 ? Math.round((basic / monthDays) * payableDays) : 0;

  const otHours = otDay + otNight;
  const otAmount =
    monthDays > 0
      ? (basic / (monthDays * cfg.OT_NIGHT_DIVISOR)) * otNight +
        (basic / (monthDays * cfg.OT_DAY_DIVISOR)) * otDay
      : 0;
  const dept = String(input.department || "").trim().toLowerCase();
  const ot20 = cfg.OT20_EXCLUDED_DEPARTMENTS.includes(dept) ? 0 : otAmount * cfg.OT_EXTRA_RATE;

  const bonusLost =
    absent > 0 || leave > 0 || late > cfg.ATT_BONUS_MAX_LATE_DAYS ||
    cfg.BONUS_EXCLUDED_DEPARTMENTS.includes(dept);
  const attBonus = bonusLost || monthDays <= 0 ? 0 : basic / monthDays;
  const nightAllowance = night * cfg.NIGHT_ALLOWANCE_PER_NIGHT;

  const prevAdd = n(input.prevAdjAddition);
  const prevDed = n(input.prevAdjDeduction);
  const advance = n(input.advance);
  const loan = n(input.loanDeduction); // Advance & Loan মডিউলের অনুমোদিত কিস্তি

  const netPayable = Math.round(
    salaryPayable + otAmount + ot20 + attBonus + nightAllowance + prevAdd - (advance + loan + prevDed),
  );

  return {
    present, payableDays, salaryPayable, otHours, otAmount, ot20, attBonus, nightAllowance, netPayable,
  };
};

module.exports = { computeLine };
