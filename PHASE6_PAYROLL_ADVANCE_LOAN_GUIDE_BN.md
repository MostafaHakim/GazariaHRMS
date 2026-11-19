# Gazaria HRMS — Phase 6: Company-wise Payroll, Advance & Loan

এই প্যাকেজটি Phase 5-এর cumulative project-এর উপর তৈরি। Phase 1–5-এর Company, Employee, Department/Designation, Shift/Device/Attendance, Roster, Holiday ও Leave কোড অন্তর্ভুক্ত আছে। Phase 6-এ Payroll এবং Advance & Loan-এ Company isolation যোগ করা হয়েছে।

## Phase 6-এ কী পরিবর্তন হয়েছে

### Payroll
- `PayrollRun`-এ `company` বাধ্যতামূলক করা হয়েছে।
- একই মাসে আলাদা কোম্পানির আলাদা Payroll Run করা যাবে। Unique key এখন `company + month`।
- `PayrollLine`-এও `company` রাখা হয়েছে এবং সব লাইন বর্তমান কোম্পানি অনুযায়ী query হয়।
- Generate/Regenerate শুধু নির্বাচিত কোম্পানির Employee, Daily Attendance, Shift ও Advance/Loan installment ব্যবহার করে।
- Edit, Finalize, Mark Paid, Reopen, Delete এবং Excel Export-এ Company filter প্রয়োগ করা হয়েছে।
- আগের `payrollCalc.js`, salary calculation formula, OT, attendance bonus, night allowance, previous adjustment addition/deduction এবং payment method-এর হিসাব পরিবর্তন করা হয়নি।

### Advance & Loan
- `AdvanceLoan`-এ `company` বাধ্যতামূলক করা হয়েছে।
- Loan/Advance তৈরি করার সময় Employee অবশ্যই নির্বাচিত কোম্পানির হতে হবে।
- List, summary, details, edit, approve, reject, cancel, close ও delete সব operation Company scoped।
- Payroll installment load, conflict check, Mark Paid এবং draft payroll refresh-এ Company filter প্রয়োগ করা হয়েছে।
- একই Employee ID অন্য কোম্পানিতে থাকলেও তার Loan/Advance অন্য কোম্পানির Payroll-এ যাবে না।

### Group Admin
- Payroll পেজে `Group Payroll Summary` বাটন যুক্ত হয়েছে।
- নির্বাচিত মাসের সব Active Company-এর Payroll Status, Employee Count ও Net Payable একসঙ্গে দেখা যাবে।
- Group summary read-only; এটি কোনো কোম্পানির Payroll পরিবর্তন করে না।

### Security
- `/api/payroll` এবং `/api/advances` রুটে `requireCompany` middleware যুক্ত হয়েছে।
- প্রতিটি request-এ `X-Company-Id` থাকতে হবে এবং User-এর Company Access যাচাই হবে।
- Group Admin (`ADMIN`) সব Active Company-তে access পাবে; HR/Accounts কেবল assigned company-তে access পাবে।
- Frontend-এর active company পরিবর্তন হলে Payroll ও Advance/Loan তালিকা পুনরায় লোড হয়।

## ইনস্টল করার আগে

1. Backend ও Frontend-এর সম্পূর্ণ backup নিন।
2. MongoDB-এর `mongodump`/Atlas backup নিন।
3. চলমান server বন্ধ করুন।
4. ZIP extract করে Phase 5 project-এর সঙ্গে folder structure অনুযায়ী merge/replace করুন।
5. নিজের `backend/.env` এবং `frontend/.env` ফাইল overwrite করবেন না।

## Install ও চালু

Backend:

```bash
cd backend
npm install
npm run prepare:phase6-indexes
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run build
npm run dev
```

`prepare:phase6-indexes` চালানোর সময় MongoDB সংযোগের জন্য `backend/.env`-এ `MONGODB_URI` থাকতে হবে। Scriptটি Payroll-এর পুরোনো `month_1` unique index সরিয়ে `company + month` unique index তৈরি করে এবং Advance/Loan-এর company compound index তৈরি করে।

## পুরোনো ডেটা সম্পর্কে

আপনার সিদ্ধান্ত অনুযায়ী নতুন করে Company-wise Payroll ও Advance/Loan শুরু হবে। পুরোনো PayrollRun/PayrollLine/AdvanceLoan রেকর্ড delete বা স্বয়ংক্রিয়ভাবে কোনো কোম্পানিতে assign করা হচ্ছে না। যেসব পুরোনো রেকর্ডে `company` নেই, নতুন Company-scoped screens/API-তে সেগুলো দেখা যাবে না। পুরোনো ডেটা প্রয়োজন হলে আলাদা, অনুমোদিত mapping পরিকল্পনা ছাড়া migration করবেন না।

## যাচাই করার ধাপ

1. Group Admin দিয়ে login করুন এবং Company A নির্বাচন করুন।
2. Company A-তে Employee, Attendance ও Shift আছে নিশ্চিত করুন।
3. Payroll Generate করে Employee list ও total যাচাই করুন।
4. Company B নির্বাচন করে একই মাসের Payroll Generate করুন। Company A-এর Employee/amount যেন Company B-তে না আসে।
5. Company A-তে একজন Employee-এর Advance/Loan তৈরি ও approve করুন।
6. Company A-এর Payroll Regenerate করে installment deduction যাচাই করুন।
7. Company B-এর Payroll-এ ওই installment যেন না আসে।
8. Company A-তে Payroll Finalize/Mark Paid করে installment deducted হয়েছে যাচাই করুন।
9. Group Payroll Summary খুলে দুই কোম্পানির আলাদা status ও combined totals যাচাই করুন।
10. HR/Accounts user দিয়ে অন্য অনুমোদনহীন Company ID পাঠিয়ে API request করলে 403 আসে নিশ্চিত করুন।

## গুরুত্বপূর্ণ সীমাবদ্ধতা ও Test Status

- Backend-এর সব `.js` ফাইলে `node --check` চালানো হয়েছে; syntax check পাস করেছে।
- Frontend dependency install না থাকায় production `npm run build` এই পরিবেশে চালানো যায়নি। আপনার মেশিনে build চালিয়ে ফলাফল যাচাই করতে হবে।
- MongoDB runtime, API integration, Excel file output এবং বাস্তব Payroll/Loan settlement এখনো live database-এ পরীক্ষা করা হয়নি।
- Phase 6 ব্যবহার করার আগে Phase 1–5-এর company middleware ও active company selector সঠিকভাবে কাজ করছে নিশ্চিত করুন।
- Index script চালানোর আগে backup বাধ্যতামূলক। Script পুরোনো data delete করে না, তবে Payroll-এর পুরোনো month-only unique index পরিবর্তন করে।
