# Gazaria HRMS Multi-Company — Phase 5 (বাংলা)

## এই Phase-এ কী পরিবর্তন হয়েছে

1. WeeklyRoster-এ বাধ্যতামূলক `company`; একই সপ্তাহে প্রতিটি কোম্পানির আলাদা Roster হবে।
2. RosterAssignment-এ `company`; Employee + Effective Date uniqueness এখন Company-সহ।
3. ShiftRotation Model-এ `company` এবং company-aware index যোগ হয়েছে।
4. Roster Generate, Preview, Assign, Override, Publish, Manual Shift Change এবং Mid-week Change-এ Company filter প্রয়োগ হয়েছে।
5. Shift ও Employee একই নির্বাচিত কোম্পানির কি না Backend যাচাই করে।
6. Holiday ও Leave-এ বাধ্যতামূলক `company`; CRUD/list এবং Leave overlap check কোম্পানিভিত্তিক।
7. Holiday-তে অন্য কোম্পানির Department ব্যবহার করা যাবে না।
8. Attendance calculation এখন নির্বাচিত কোম্পানির Weekly Roster, Holiday এবং Approved Leave-ই পড়ে।
9. Weekly Roster, Roster Plan, Holiday ও Leave API-তে `requireCompany` middleware যোগ হয়েছে।
10. Frontend-এ কোম্পানি পরিবর্তন করলে সংশ্লিষ্ট Roster, Shift, Holiday, Leave ও Plan data reload হবে।

## ইনস্টলেশন

1. Phase 4 প্রজেক্টের সম্পূর্ণ Backup নিন।
2. ZIP-এর `backend` ও `frontend` ফোল্ডার Phase 4 প্রজেক্টে Merge/Replace করুন। নিজের `backend/.env` ফাইল অক্ষত রাখুন।
3. MongoDB Backup নেওয়ার পর Backend-এ চালান:

```bash
cd backend
npm install
npm run prepare:phase5-indexes
npm run dev
```

4. Frontend:

```bash
cd frontend
npm install
npm run build
npm run dev
```

## পুরোনো ডেটা সম্পর্কে

আপনার সিদ্ধান্ত অনুযায়ী পুরোনো ডেটা নতুন কোম্পানিতে auto-migrate করা হয়নি। পুরোনো WeeklyRoster, RosterAssignment, Holiday ও Leave document-এ Company ID না থাকলে নতুন Company-wise API-তে সেগুলো দেখা যাবে না। কোনো business record মুছে ফেলা হয়নি। নতুন কোম্পানি নির্বাচন করে নতুন Roster/Leave/Holiday/Assignment তৈরি করুন। পুরোনো global unique index কেবল Phase 5 index script সরিয়ে company-aware unique index তৈরি করে।

## পরীক্ষার তালিকা

- [ ] Company A-তে সপ্তাহের Roster Generate করুন।
- [ ] Company B-তে একই সপ্তাহের আলাদা Roster Generate করুন।
- [ ] Company A-র Roster ID দিয়ে Company B থেকে Edit/Publish চেষ্টা করলে 404 হবে।
- [ ] Company A-র Employee-কে Company B-র Shift assign করা যাবে না।
- [ ] একই Employee ID দুই কোম্পানিতে থাকলেও Assignment পৃথক থাকবে।
- [ ] Company A-র Holiday Company B-র Holiday List-এ দেখা যাবে না।
- [ ] Company B-র Department Company A-র Holiday-তে ব্যবহার করা যাবে না।
- [ ] Company A-র Leave Company B-র Leave List বা Attendance Calculation-এ প্রভাব ফেলবে না।
- [ ] Group Admin কোম্পানি পরিবর্তন করে আলাদা আলাদা তথ্য দেখতে পারবেন।

## সীমাবদ্ধতা

এই Phase-এ Weekly Roster, Roster Assignment, Shift Rotation Model, Holiday ও Leave Company-scoped হয়েছে। Shift Rotation-এর legacy model কেবল compatibility/পুরোনো কাঠামোর অংশ; বর্তমান active rotation flow `RosterAssignment` ও `RosterPlan`-এর মাধ্যমে চলে। Real ZKTeco hardware test এবং end-to-end MongoDB runtime test এই প্যাকেজে করা হয়নি।
