const ExcelJS = require("exceljs");
const cfg = require("../config/payrollConfig");
const { buildSummary } = require("./payrollService");

const COMPANY = process.env.COMPANY_NAME || "Gazaria Elastic Industries Limited";
const ADDRESS = process.env.COMPANY_ADDRESS || "Dashergaon, Lokhonkhola, Bandar, Narayanganj";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const titleOf = (month) => {
  const [y, m] = month.split("-").map(Number);
  return `Payroll Sheet  — ${MONTHS[m - 1]} ${y}`;
};
const exportFileName = (month) => {
  const [y, m] = month.split("-").map(Number);
  return `Payroll_Sheet_${MONTHS[m - 1].slice(0, 3)}_${String(y).slice(2)}.xlsx`;
};

const NAVY = "FF1F4E78";
const LIGHT = "FFD9E1F2";
const thin = { style: "thin", color: { argb: "FF7F7F7F" } };
const BORDER = { top: thin, left: thin, bottom: thin, right: thin };
const ACC = '_(* #,##0_);_(* \\(#,##0\\);_(* "-"??_);_(@_)';

const asIdValue = (id) => (/^\d+$/.test(String(id)) ? Number(id) : String(id));
const col = (n) => {
  let s = "";
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
};

const addTitle = (ws, month, lastCol) => {
  const rows = [[COMPANY, 16, true, NAVY], [ADDRESS, 10, false, "FF595959"], [titleOf(month), 12, true, NAVY]];
  rows.forEach(([text, size, bold, color], i) => {
    ws.mergeCells(i + 1, 1, i + 1, lastCol);
    const c = ws.getCell(i + 1, 1);
    c.value = text;
    c.font = { name: "Calibri", size, bold, color: { argb: color } };
    c.alignment = { horizontal: "center", vertical: "middle" };
  });
  ws.getRow(1).height = 21;
};

const styleHeader = (row, fill = NAVY) => {
  row.eachCell((c) => {
    c.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    c.border = BORDER;
  });
};

// ---------- 1) Payroll Summary (ফর্মুলা সহ, শিটের মতো) ----------
const HEAD = [
  "SL", "Department", "ID", "Name", "Designation", "Month Days", "Present", "Absent", "Leave", "Late",
  "WH Days", "Night", "Payable Days", "Basic Salary", "Salary Payable", "OT (Day) Hours", "OT (Night) Hours",
  "OT  Hours", "OT Amount", "OT 20%", "Att. Bonus", "Night Allowance", "Previous Adjustment Addition",
  "Previous Adjustment Deduction", "Advance", "Net Payable", "Method", "BKASH/BANK\nACCOUNT NUMBER ", "Remarks",
];
const WIDTH = [4.5, 12, 8, 20, 14, 6, 6.5, 6.5, 6, 5.5, 6.5, 6, 8, 9, 9.5, 8, 8, 7, 9, 8, 9, 9, 11, 11, 8.5, 10.5, 8, 15, 28];

const buildSummarySheet = (wb, month, lines) => {
  const ws = wb.addWorksheet("Payroll Summary", {
    views: [{ state: "frozen", xSplit: 4, ySplit: 4 }],
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.columns = WIDTH.map((width) => ({ width }));
  addTitle(ws, month, 26);

  const head = ws.getRow(4);
  HEAD.forEach((h, i) => (head.getCell(i + 1).value = h));
  head.height = 36.75;
  styleHeader(head);
  ws.pageSetup.printTitlesRow = "4:4";

  const first = 5;
  lines.forEach((l, i) => {
    const r = first + i;
    const row = ws.getRow(r);
    const f = (c, formula, result) => (row.getCell(c).value = { formula, result });
    const D = cfg.OT_DAY_DIVISOR, N = cfg.OT_NIGHT_DIVISOR;
    const dept = String(l.department).trim().toLowerCase();

    row.getCell(1).value = l.sl;
    row.getCell(2).value = l.department;
    row.getCell(3).value = asIdValue(l.employeeId);
    row.getCell(4).value = l.name;
    row.getCell(5).value = l.designation;
    row.getCell(6).value = l.monthDays;
    f(7, `F${r}-(H${r}+I${r}+K${r})`, l.present);
    row.getCell(8).value = l.absent;
    row.getCell(9).value = l.leave;
    row.getCell(10).value = l.late;
    row.getCell(11).value = l.whDays;
    row.getCell(12).value = l.night;
    f(13, `G${r}+K${r}+I${r}`, l.payableDays);
    row.getCell(14).value = l.basicSalary;
    f(15, `ROUND((N${r}/F${r})*M${r},0)`, l.salaryPayable);
    row.getCell(16).value = l.otDayHours;
    row.getCell(17).value = l.otNightHours;
    f(18, `P${r}+Q${r}`, l.otHours);
    f(19, `(N${r}/(F${r}*${N})*Q${r})+(N${r}/(F${r}*${D})*P${r})`, l.otAmount);
    if (cfg.OT20_EXCLUDED_DEPARTMENTS.includes(dept)) row.getCell(20).value = 0;
    else f(20, `S${r}*${cfg.OT_EXTRA_RATE * 100}%`, l.ot20);
    if (cfg.BONUS_EXCLUDED_DEPARTMENTS.includes(dept)) row.getCell(21).value = 0;
    else f(21, `IF(H${r}>0,0,IF(I${r}>0,0,IF(J${r}>${cfg.ATT_BONUS_MAX_LATE_DAYS},0,(N${r}/F${r}))))`, l.attBonus);
    f(22, `L${r}*${cfg.NIGHT_ALLOWANCE_PER_NIGHT}`, l.nightAllowance);
    row.getCell(23).value = l.prevAdjAddition || null;
    row.getCell(24).value = l.prevAdjDeduction || null;
    row.getCell(25).value = l.advance || null;
    f(26, `ROUND(O${r}+S${r}+T${r}+U${r}+V${r}+W${r}-(Y${r}+X${r}),0)`, l.netPayable);
    row.getCell(27).value = l.method;
    row.getCell(28).value = l.accountNumber ? String(l.accountNumber) : null;
    row.getCell(28).numFmt = "@";
    row.getCell(29).value = l.remarks || null;

    row.eachCell({ includeEmpty: true }, (c, n) => {
      if (n > 29) return;
      c.font = { name: n === 4 || n === 5 ? "Cambria" : "Calibri", size: 9.5, bold: n === 14 || n === 26 };
      c.alignment = { horizontal: n === 4 || n === 5 || n === 29 ? "left" : "center", vertical: "middle" };
      if (n <= 28) c.border = BORDER;
      if (n >= 14 && n <= 26 && n !== 16 && n !== 17 && n !== 18) c.numFmt = n === 14 ? ACC : "0";
    });
    if (l.method === "Hold") row.eachCell((c, n) => n <= 28 && (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } }));
  });

  // Grand total
  const last = first + lines.length - 1;
  const tr = ws.getRow(last + 1);
  tr.getCell(4).value = "GRAND TOTAL";
  const sumCols = [14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26];
  const keyOf = { 14: "basicSalary", 15: "salaryPayable", 16: "otDayHours", 17: "otNightHours", 18: "otHours", 19: "otAmount", 20: "ot20", 21: "attBonus", 22: "nightAllowance", 23: "prevAdjAddition", 24: "prevAdjDeduction", 25: "advance", 26: "netPayable" };
  sumCols.forEach((c) => {
    tr.getCell(c).value = {
      formula: `SUM(${col(c)}${first}:${col(c)}${last})`,
      result: lines.reduce((s, l) => s + (Number(l[keyOf[c]]) || 0), 0),
    };
    tr.getCell(c).numFmt = ACC;
  });
  for (let c = 1; c <= 28; c++) {
    const cell = tr.getCell(c);
    cell.font = { name: "Calibri", size: 10.5, bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT } };
    cell.border = BORDER;
    cell.alignment = { horizontal: c === 4 ? "left" : "center", vertical: "middle" };
  }
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: 28 } };
  return { first, last };
};

// ---------- 2) Report (ডিপার্টমেন্ট-ওয়াইজ, প্রতি ডিপার্টমেন্ট আলাদা পাতা) ----------
const buildReportSheet = (wb, month, lines) => {
  const ws = wb.addWorksheet("Report", {
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const cols = [
    ["SL", 4.5], ["ID", 8], ["Name", 20], ["Designation", 14], ["Month Days", 6], ["Present", 6.5], ["Absent", 6.5], ["Leave", 6],
    ["Late", 5.5], ["WH Days", 6.5], ["Night", 6], ["Payable Days", 8], ["Basic Salary", 9], ["Salary Payable", 9.5],
    ["OT (Day) Hours", 8], ["OT (Night) Hours", 8], ["OT Hours", 7], ["OT Amount", 9], ["OT 20%", 8], ["Att. Bonus", 9],
    ["Night Allowance", 9], ["Previous Adjustment Addition", 11], ["Previous Adjustment Deduction", 11], ["Advance", 8.5], ["Net Payable", 10.5],
  ];
  ws.columns = cols.map(([, width]) => ({ width }));
  const keys = [null, "employeeId", "name", "designation", "monthDays", "present", "absent", "leave", "late", "whDays", "night",
    "payableDays", "basicSalary", "salaryPayable", "otDayHours", "otNightHours", "otHours", "otAmount", "ot20", "attBonus",
    "nightAllowance", "prevAdjAddition", "prevAdjDeduction", "advance", "netPayable"];
  const sumFrom = 13; // Basic Salary থেকে ডানে

  addTitle(ws, month, cols.length);
  let r = 4;
  const depts = [...new Set(lines.map((l) => l.department))];

  depts.forEach((dept, di) => {
    const group = lines.filter((l) => l.department === dept);
    if (di > 0) ws.getRow(r - 1).addPageBreak();
    ws.getCell(r, 1).value = `Department: ${dept}`;
    ws.getCell(r, 1).font = { name: "Calibri", size: 11, bold: true, color: { argb: NAVY } };
    r++;
    const head = ws.getRow(r);
    cols.forEach(([h], i) => (head.getCell(i + 1).value = h));
    head.height = 36.75;
    styleHeader(head);
    r++;
    const first = r;
    group.forEach((l, i) => {
      const row = ws.getRow(r);
      keys.forEach((k, ci) => {
        const c = row.getCell(ci + 1);
        c.value = k === null ? i + 1 : k === "employeeId" ? asIdValue(l[k]) : l[k];
        c.font = { name: "Calibri", size: 9.5, bold: k === "netPayable" };
        c.border = BORDER;
        c.alignment = { horizontal: k === "name" || k === "designation" ? "left" : "center", vertical: "middle" };
        if (ci + 1 >= sumFrom && !["otDayHours", "otNightHours", "otHours"].includes(k)) c.numFmt = ACC;
      });
      r++;
    });
    const tr = ws.getRow(r);
    tr.getCell(3).value = `Total — ${dept}`;
    for (let c = sumFrom; c <= cols.length; c++) {
      tr.getCell(c).value = {
        formula: `SUM(${col(c)}${first}:${col(c)}${r - 1})`,
        result: group.reduce((s, l) => s + (Number(l[keys[c - 1]]) || 0), 0),
      };
      tr.getCell(c).numFmt = ACC;
    }
    for (let c = 1; c <= cols.length; c++) {
      const cell = tr.getCell(c);
      cell.font = { name: "Calibri", size: 10, bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT } };
      cell.border = BORDER;
      cell.alignment = { horizontal: c === 3 ? "left" : "center" };
    }
    r += 3;
  });
};

// ---------- 3) TOP_SHEET (ডিপার্টমেন্ট সামারি, Payroll Summary থেকে লাইভ SUMIF) ----------
const buildTopSheet = (wb, month, lines, range) => {
  const ws = wb.addWorksheet("TOP_SHEET", {
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const heads = ["SL", "Department Name", "Headcount", "Basic Salary", "Salary Payable", "OT (Day) Hours", "OT (Night) Hours", "OT Hours", "OT Amount",
    "OT 20%", "Att. Bonus", "Night Allowance", "Previous Adjustment Addition", "Previous Adjustment Deduction", "Advance", "Net Payable"];
  ws.columns = [5, 20, 10, 13, 13, 11, 11, 10, 12, 11, 11, 12, 15, 15, 11, 14].map((width) => ({ width }));
  addTitle(ws, month, heads.length);
  ws.getCell(3, 1).value = `Summary of Payroll Sheet  — ${titleOf(month).split("— ")[1]}`;

  const head = ws.getRow(5);
  heads.forEach((h, i) => (head.getCell(i + 1).value = h));
  head.height = 36.75;
  styleHeader(head);

  const { departments, totals } = buildSummary(lines);
  const src = (c) => `'Payroll Summary'!$${c}$${range.first}:$${c}$${range.last}`;
  // কলাম ম্যাপ: TOP কলাম -> Payroll Summary কলাম
  const map = [["D", "basicSalary", "N"], ["E", "salaryPayable", "O"], ["F", "otDayHours", "P"], ["G", "otNightHours", "Q"], ["H", "otHours", "R"],
    ["I", "otAmount", "S"], ["J", "ot20", "T"], ["K", "attBonus", "U"], ["L", "nightAllowance", "V"], ["M", "prevAdjAddition", "W"],
    ["N", "prevAdjDeduction", "X"], ["O", "advance", "Y"], ["P", "netPayable", "Z"]];

  let r = 6;
  departments.forEach((d, i) => {
    const row = ws.getRow(r);
    row.getCell(1).value = i + 1;
    row.getCell(2).value = d.department;
    row.getCell(3).value = { formula: `COUNTIF(${src("B")},$B${r})`, result: d.headcount };
    map.forEach(([tc, key, sc]) => {
      row.getCell(tc).value = { formula: `SUMIF(${src("B")},$B${r},${src(sc)})`, result: d[key] };
      row.getCell(tc).numFmt = ["F", "G", "H"].includes(tc) ? "0" : "#,##0.00";
    });
    for (let c = 1; c <= heads.length; c++) {
      const cell = row.getCell(c);
      cell.font = { name: "Calibri", size: 11, bold: c === 16 };
      cell.border = BORDER;
      cell.alignment = { horizontal: c === 2 ? "left" : c <= 3 ? "center" : "right" };
    }
    r++;
  });

  const tr = ws.getRow(r);
  tr.getCell(2).value = "GRAND TOTAL";
  tr.getCell(3).value = { formula: `SUM(C6:C${r - 1})`, result: totals.headcount };
  map.forEach(([tc, key]) => {
    tr.getCell(tc).value = { formula: `SUM(${tc}6:${tc}${r - 1})`, result: totals[key] };
    tr.getCell(tc).numFmt = ["F", "G", "H"].includes(tc) ? "0" : "#,##0.00";
  });
  for (let c = 1; c <= heads.length; c++) {
    const cell = tr.getCell(c);
    cell.font = { name: "Calibri", size: 12, bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT } };
    cell.border = BORDER;
    cell.alignment = { horizontal: c === 2 ? "left" : c === 3 ? "center" : "right" };
  }
};

// ---------- 4) BKASH / BANK / CASH পেমেন্ট লিস্ট ----------
const buildPaymentSheet = (wb, month, lines, method, sheetName, accountLabel) => {
  const list = lines.filter((l) => l.method === method && l.netPayable > 0);
  if (!list.length && method !== "Bkash") return;

  const ws = wb.addWorksheet(sheetName);
  ws.columns = [{ width: 10 }, { width: 20 }, { width: 18 }, { width: 24 }, { width: 12 }];
  addTitle(ws, month, 5);
  ws.getCell(4, 1).value = method;
  ws.getCell(4, 1).font = { name: "Calibri", size: 11, bold: true };

  const head = ws.getRow(5);
  ["SL No.", accountLabel, "Principal Amount", " Name", "ID"].forEach((h, i) => (head.getCell(i + 1).value = h));
  styleHeader(head);

  list.forEach((l, i) => {
    const row = ws.getRow(6 + i);
    row.getCell(1).value = i + 1;
    row.getCell(2).value = l.accountNumber ? String(l.accountNumber) : "";
    row.getCell(2).numFmt = "@";
    row.getCell(3).value = l.netPayable;
    row.getCell(4).value = l.name;
    row.getCell(5).value = asIdValue(l.employeeId);
    for (let c = 1; c <= 5; c++) {
      row.getCell(c).border = BORDER;
      row.getCell(c).font = { name: "Calibri", size: 11 };
      row.getCell(c).alignment = { horizontal: c === 4 ? "left" : "center" };
    }
    if (method !== "Cash" && !l.accountNumber) row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC7CE" } };
  });

  const t = ws.getRow(6 + list.length);
  t.getCell(2).value = "TOTAL";
  t.getCell(3).value = { formula: `SUM(C6:C${5 + list.length})`, result: list.reduce((s, l) => s + l.netPayable, 0) };
  t.getCell(3).numFmt = "#,##0";
  for (let c = 1; c <= 5; c++) {
    t.getCell(c).font = { name: "Calibri", size: 11, bold: true };
    t.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT } };
    t.getCell(c).border = BORDER;
    t.getCell(c).alignment = { horizontal: "center" };
  }
};

// শিটের "Advance" কলামে হাতের অ্যাডভান্স + Advance/Loan কিস্তি একসাথে দেখায় (ফর্মুলা একই থাকে);
// কোন কিস্তি তা Remarks এ লেখা হয়।
const withLoanInAdvance = (l) => {
  const loan = Number(l.loanDeduction) || 0;
  if (!loan) return l;
  const note = `Adv/Loan: ${(l.loanRefs || []).map((r) => `${r.label} ${r.amount}`).join(", ")}`;
  return {
    ...l,
    advance: (Number(l.advance) || 0) + loan,
    loanDeduction: 0,
    remarks: [l.remarks, note].filter(Boolean).join(" | "),
  };
};

const buildWorkbook = async (month, rawLines) => {
  const lines = rawLines.map(withLoanInAdvance);
  const wb = new ExcelJS.Workbook();
  wb.creator = COMPANY;
  wb.created = new Date();

  const range = buildSummarySheet(wb, month, lines);
  buildReportSheet(wb, month, lines);
  buildTopSheet(wb, month, lines, range);
  buildPaymentSheet(wb, month, lines, "Bkash", "BKASH", "Wallet No");
  buildPaymentSheet(wb, month, lines, "Bank", "BANK", "Account No");
  buildPaymentSheet(wb, month, lines, "Cash", "CASH", "Mobile / Ref");
  return wb;
};

module.exports = { buildWorkbook, exportFileName };
