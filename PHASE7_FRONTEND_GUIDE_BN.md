# Phase 7 — Frontend Dashboard & Finance UI (বাংলা)

## নতুন UI
- `/group-dashboard` — শুধু ADMIN / Group Admin; মাস নির্বাচন করে সব Active Company-এর Employee, Payroll Net Payable এবং Recorded Expense সারাংশ।
- `/expenses` — নির্বাচিত কোম্পানির Expense List, date filter, Add Expense। ACCOUNTS role শুধু দেখতে পারবে।
- `/payment-history` — নির্বাচিত কোম্পানির মাসভিত্তিক Payment History এবং Manual Payment Record। ACCOUNTS role শুধু দেখতে পারবে।
- `/audit-logs` — শুধু ADMIN; নির্বাচিত কোম্পানির Audit Log, module filter।
- `/company-access` — শুধু ADMIN; non-admin User-দের Company Access এবং Default Company নির্ধারণ।

## ইনস্টল
1. Phase 7 backend foundation ZIP-এর ওপর এই ZIP-এর `frontend` ফোল্ডার merge করুন।
2. `frontend` ফোল্ডারে `npm install` চালান।
3. `npm run build` দিয়ে Production Build যাচাই করুন।
4. `npm run dev` দিয়ে চালু করুন।
5. Login করে Topbar থেকে Company নির্বাচন করুন। Finance pages নির্বাচিত কোম্পানির `X-Company-Id` header ব্যবহার করে।

## API নির্ভরতা
- `GET /api/group/dashboard?month=YYYY-MM`
- `GET/POST /api/finance/expenses`
- `GET/POST /api/finance/payments`
- `GET /api/finance/audit`
- `PATCH /api/users/:id/company-access`

## গুরুত্বপূর্ণ সীমাবদ্ধতা
- Payroll-এর Mark Paid action থেকে Payment History স্বয়ংক্রিয়ভাবে তৈরি হয় না; Payment History পেজে আপাতত Manual Record করতে হয়।
- Expense পেজে Create ও List আছে; Edit/Void UI এখনো নেই যদিও Backend Update API আছে।
- Audit page কেবল বর্তমান Phase 7-এ instrument করা Expense, Payment এবং User Company Access পরিবর্তন দেখাবে।
- Group Dashboard API-তে Payroll Run summary ও Recorded Expense আছে; এটি পূর্ণ accounting ledger, bank reconciliation বা statutory report নয়।
- Runtime API, MongoDB এবং Browser interaction test করতে হবে।
