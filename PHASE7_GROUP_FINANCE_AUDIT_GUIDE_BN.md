# Phase 7 — Group Dashboard, Finance & Audit (Foundation)

## অন্তর্ভুক্ত
- Group Admin dashboard API: `GET /api/group/dashboard?month=YYYY-MM`
- Company-scoped expense CRUD/list API: `/api/finance/expenses`
- Company-scoped salary payment history API: `/api/finance/payments`
- Admin-only company-scoped audit log read API: `/api/finance/audit`
- Admin-only user company access update API: `PATCH /api/users/:id/company-access`
- Expense, PaymentRecord, AuditLog models and Phase 7 index preparation script.

## ইনস্টল
1. Phase 6 project backup ও MongoDB backup নিন।
2. এই ZIP-এর `backend` ও `frontend` ফোল্ডার Phase 6 project-এর সঙ্গে merge করুন। `.env` ফাইল overwrite করবেন না।
3. `cd backend && npm install && npm run prepare:phase7-indexes && npm run dev`
4. `cd frontend && npm install && npm run build`

## API নোট
- `/api/finance/*` route-এ `X-Company-Id` আবশ্যক এবং User-এর companyAccess যাচাই হয়।
- Group dashboard ও User company-access পরিবর্তন শুধু `ADMIN` করতে পারবেন।
- Payment history endpoint-এ payment record আলাদাভাবে POST করতে হয়; Payroll mark-paid action থেকে স্বয়ংক্রিয়ভাবে payment record তৈরি করার integration এই Phase-এ করা হয়নি।
- Audit logging এই Phase-এ Expense, Payment এবং User company-access পরিবর্তনে যুক্ত। সব পুরোনো module-এর সব action-এ global audit instrumentation এখনো সম্পূর্ণ নয়।
- Group dashboard-এ Payroll summary এবং Expense totals আছে; পূর্ণ accounting ledger, voucher, bank reconciliation ও statutory reports এই Phase-এর বাইরে।

## নিরাপত্তা ও পরীক্ষা
- MongoDB backup ছাড়া index script চালাবেন না।
- Syntax check পাস করলেও production-এ ব্যবহারের আগে MongoDB runtime, role permission, company isolation ও frontend integration test করুন।
