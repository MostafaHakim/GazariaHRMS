# Security Punch App (Megabox) — আলাদা মোবাইল অ্যাপ, একই ডাটাবেজ

> আগের `GazariaHRMS_webpunch.zip` (Employee self-punch) ব্যবহার করে থাকলে এই জিপের ফাইলগুলো একই পাথে ওভাররাইট করুন। এটি সেটার বদলে।

## কাঠামো
- `punch-app/` = আলাদা ছোট React অ্যাপ (আলাদা ডমেনে ডিপ্লয় হবে, যেমন punch.yourdomain.com)।
- ব্যাকএন্ড ও MongoDB একই। পাঞ্চগুলো `AttendanceLog`-এ সেভ হয় (deviceId = `WEB`), তাই Daily Attendance / Job Card / Payroll আগের নিয়মেই হিসাব করে।

## সেটআপ
1. ব্যাকএন্ডের ফাইল কপি করে রিস্টার্ট করুন (নতুন প্যাকেজ/মাইগ্রেশন নেই)।
2. `backend/.env` এর `FRONTEND_URL` এ পাঞ্চ-অ্যাপের ডমেন কমা দিয়ে যোগ করুন (নইলে CORS ব্লক করবে):
   `FRONTEND_URL=https://hrms.example.com,https://punch.example.com`
3. `punch-app` এ: `.env.example` কপি করে `.env` বানিয়ে `VITE_API_URL` দিন → `npm install` → `npm run build` → `dist` ডিপ্লয় (Vercel/Netlify/নিজের সার্ভার)।
4. মূল HRMS এ Admin → **Users & Roles → Add User** → Role **Security (Punch app)** → কোম্পানি বাছুন → যে কর্মীদের পাঞ্চ দিতে পারবে তাদের টিক দিন (Select shown / Clear আছে) → username/password।
   পরে Edit করে কর্মী যোগ/বাদ দেওয়া যায়।
5. Megabox-এর কর্মীদের Roster Plan / Weekly Roster-এ রাখুন — না থাকলে Daily Attendance হিসাব হবে না।

## সিকিউরিটি যা পারবে / পারবে না
- পারবে: নিজের তালিকার কর্মীদের IN / OUT দেওয়া; কখন পাঞ্চ হয়েছে দেখা; আগের দিনের পাঞ্চ দেখা (তারিখ বদলে)।
- পারবে না: পাঞ্চ এডিট/ডিলিট (সার্ভারে সেই API-ই নেই); তালিকার বাইরের কর্মীকে পাঞ্চ; মূল HRMS-এর কোনো API।
- সময় সার্ভার থেকে বসে — মোবাইলের ঘড়ি বদলালেও লাভ নেই। কে পাঞ্চ দিল তা লগে (`operatorName`) ও Audit Log-এ থাকে।
- পাঞ্চের আগে কনফার্ম স্ক্রিন আসে (ভুল চাপ কমাতে)।

## সিস্টেমের নিয়ম
- IN ছাড়া OUT হবে না; IN থাকলে আবার IN হবে না।
- আগের পাঞ্চের `PUNCH_DEDUPE_MINUTES` (উদাহরণ .env-এ ২৪০ মিনিট) এর মধ্যে নতুন পাঞ্চ নেওয়া হয় না — হিসাবের সার্ভিস ঐ সময়ের পাঞ্চ একটাই ধরে, নইলে OUT হারিয়ে যেত।
- IN দিয়ে ১৮ ঘণ্টার বেশি OUT না হলে পরদিন নতুন IN দেওয়া যায় (`WEB_PUNCH_MAX_OPEN_HOURS`)।
- ভুল পাঞ্চ ঠিক করতে HR/Admin আগের মতো Daily Attendance থেকে ম্যানুয়াল এডিট করবে।

## ঐচ্ছিক: নির্দিষ্ট নেটওয়ার্ক থেকেই পাঞ্চ
`WEB_PUNCH_ALLOWED_IPS=192.168.1.` (শেষে ডট = সাবনেট)। সিকিউরিটি মোবাইল ডেটা ব্যবহার করলে এটা দেবেন না।
