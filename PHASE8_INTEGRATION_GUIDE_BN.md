# Gazaria HRMS — Phase 8 Integration & Verification

এই Phase 7 cumulative project-এর উপর integration-safety fix, Payroll Payment History automation এবং smoke tests যোগ করে। এটি কোনো live database-এ চালানো বা বাস্তব ZKTeco device-এ পরীক্ষা করা হয়নি।

## Phase 8-এ ঠিক করা বিষয়

1. Payroll `Mark Paid` হলে Payroll Line থেকে Payment History-তে স্বয়ংক্রিয় রেকর্ড তৈরি হবে।
   - `Bkash` → `BKASH`, `Bank` → `BANK`, `Cash` → `CASH`।
   - `Hold`, শূন্য/ঋণাত্মক amount, invalid amount এবং Employee reference না থাকা line বাদ যাবে।
   - রেকর্ডে Company, Payroll Run, Employee, Month, Amount, Method ও Account Number থাকবে।
   - একই Payroll Run পুনরায় Mark Paid request/partial retry হলে একই Employee-এর duplicate payment record হবে না; unique company+payrollRun+employee index ও upsert ব্যবহার করা হয়েছে।
2. Payroll Finalize / Paid / Reopen status পরিবর্তন Audit Log-এ লেখা হবে।
3. Company বদলালে বর্তমানে খোলা page remount হয়ে নতুন কোম্পানির data পুনরায় load করবে। এতে পুরোনো কোম্পানির তালিকা দেখিয়ে নতুন কোম্পানিতে ভুল write হওয়ার ঝুঁকি কমে।
4. Payment History পেজের undefined `canWrite` runtime error ঠিক করা হয়েছে; role অনুযায়ী Record Payment action দেখাবে।
5. Manual Payment Record-এ Employee ID দেওয়া হলে সেটি নির্বাচিত কোম্পানিতে আছে কি না যাচাই হবে। Employee ObjectId দিলে সেটিও একই কোম্পানির হতে হবে।
6. Expense update-এ invalid/negative amount, invalid date ও invalid status reject হবে।
7. Group Admin-এর selected-company Audit Log view-তে group-level (`company: null`) audit record-ও দেখা যাবে।
8. Phase 7 index preparation script-এর ভুল relative path ও npm script path ঠিক করা হয়েছে।

## ইনস্টলেশন

1. MongoDB-এর পূর্ণ Backup নিন। Phase 7 project-এরও আলাদা Backup রাখুন।
2. ZIP Extract করে `phase7work/backend` ও `phase7work/frontend` ফাইল আপনার Phase 7 project-এ merge/replace করুন।
3. নিজের `backend/.env` অক্ষত রাখুন।
4. Backend folder-এ:

```bash
npm install
npm run prepare:phase7-indexes
npm run prepare:phase8-indexes
npm test
npm run dev
```

5. Frontend folder-এ:

```bash
npm install
npm run build
npm run dev
```

## Phase 8 automated test

`npm test` pure payroll-to-payment mapping test চালায়। এতে method mapping, company/run/employee scope, HOLD/invalid amount skip এবং idempotent upsert key যাচাই করা হয়। এই test MongoDB connection ব্যবহার করে না।

## Manual integration test — বাস্তব ডেটা ব্যবহারের আগে

তিনটি test company তৈরি/নিশ্চিত করুন:
- Gazaria Elastic Industries Limited
- Gazaria Accessories Limited
- Megabox Limited

প্রতিটি কোম্পানিতে আলাদা test Employee ID ব্যবহার করে নিচের পরীক্ষা করুন:

1. Group Admin তিনটি কোম্পানি switch করতে পারেন এবং প্রতিটি কোম্পানির Employee/Department/Shift/Attendance/Payroll আলাদা থাকে।
2. Company A-এর HR user Company B ও C নির্বাচন করতে পারে না; API-তে অন্য কোম্পানির `X-Company-Id` দিলে 403 আসে।
3. প্রতিটি কোম্পানির জন্য একই `YYYY-MM` Payroll Run তৈরি করা যায়।
4. Payroll Line-এ Bkash/Bank/Cash/Hold method দিন; Payroll finalize করে Mark Paid করুন।
5. Payment History-তে শুধু Bkash/Bank/Cash line আসে; Hold আসে না; amount ও account number মিলে।
6. একই run-এর Mark Paid দ্বিতীয়বার করলে 409 আসে এবং Payment History-তে duplicate হয় না।
7. Company A-এর payment/expense record Company B-তে দেখা যায় না।
8. Company switch করলে page data নতুন কোম্পানির জন্য reload হয়।
9. Expense invalid amount/date reject হয়।
10. Payroll status পরিবর্তন Audit Log-এ দেখা যায়; User Company Access-এর group-level log Group Admin দেখতে পারেন।
11. ADMS test: প্রতিটি ডিভাইসের serial number সঠিক Company-এর Device record-এ map করুন; device থেকে test punch পাঠিয়ে Raw Log এবং Daily Attendance যাচাই করুন।

## পরীক্ষার সীমাবদ্ধতা

এই পরিবেশে backend dependency installation সম্পূর্ণ হয়নি এবং MongoDB/বাস্তব device connection উপলব্ধ ছিল না। তাই:
- Backend `node --check` syntax verification চালানো হয়েছে।
- `npm test`-এর pure mapping unit test চালানো হয়েছে।
- Frontend Vite production build, MongoDB index creation, API end-to-end, browser runtime ও ZKTeco ADMS/PULL live test এখনো চালানো হয়নি।

## সতর্কতা

- `prepare:phase8-indexes` PaymentRecord-এর unique index তৈরি করে। আগে যদি payrollRun+employee সহ duplicate generated records থেকে থাকে, index তৈরি ব্যর্থ হতে পারে; index চালানোর আগে duplicate data পরীক্ষা করুন।
- Mark Paid হলো software-এর payment ledger record; এটি bKash/Bank-এ বাস্তবে টাকা পাঠায় না। Transaction reference ও actual bank/bKash settlement আলাদাভাবে যাচাই করতে হবে।
- Phase 8 কোনো General Ledger, bank reconciliation বা statutory accounting module নয়।
