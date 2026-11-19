# Device ও Company ফিক্স (Phase 8-এর উপর)

## সমস্যার কারণ
1. **Device 0 / Sync-এ কিছু হচ্ছে না**: Multi-company হওয়ার পর ডিভাইস এখন ডাটাবেসের `Device` collection-এ প্রতি কোম্পানির আলাদা থাকে। পুরোনো `src/config/devices.js` আর কোথাও ব্যবহার হয় না। তাই কোম্পানিতে PULL ডিভাইস রেকর্ড না থাকলে Sync-এ "Total Devices: 0" আসে।
   - Devices পেজের ডিফল্ট Protocol ছিল **ADMS**; অথচ Sync শুধু **PULL (LAN)** ডিভাইস নেয়। ADMS হিসেবে যোগ করলে Sync-এ গোনাই হতো না।
   - Attendance পেজের Device কার্ডে ৩টি ডিভাইস ও IP (192.168.1.x) ফ্রন্টএন্ডে হার্ডকোড করা ছিল, আর "Connected 0/3"-ও হার্ডকোড।
2. **নতুন কোম্পানি যোগের বোতাম**: Backend-এ `POST /api/companies` ছিল, কিন্তু ফ্রন্টএন্ডে কোনো পেজ/বোতাম ছিল না।

## কী বদলেছে
**Backend**
- `services/deviceSyncService.js` (নতুন): একটি ডিভাইসের Sync ও Connection Test; ভুলের বাংলা ইঙ্গিত (timeout / refused / unreachable)।
- `deviceController.js` / `deviceRoutes.js`: প্রতি ডিভাইসে `POST /devices/:id/test` ও `POST /devices/:id/sync`; তালিকায় সর্বশেষ sync অবস্থা; PULL-এ Serial Number আর আবশ্যক নয় (IP আবশ্যক), ADMS-এ SN আবশ্যক; লেখার অনুমতি শুধু ADMIN/HR।
- `attendanceController.js`: `/attendance/sync`-এ `deviceId` দিলে শুধু ওই ডিভাইস; কোনো PULL ডিভাইস না থাকলে স্পষ্ট warning।
- `cronService.js`: একই service ব্যবহার করে (আচরণ একই)।
- `Device` model: `lastSeenAt` (ADMS ডিভাইস সর্বশেষ কখন সংকেত পাঠিয়েছে)।
- `companyController.js`: ADMIN `?all=1` দিলে নিষ্ক্রিয় কোম্পানিও দেখতে পারে।
- `scripts/importDevicesFromConfig.js` + `npm run import-devices -- <COMPANY_CODE>`: পুরোনো ৩টি ডিভাইস এক কমান্ডে একটি কোম্পানিতে তোলে।

**Frontend**
- Attendance পেজ: ডিভাইস কার্ড এখন ডাটাবেস থেকে (কোম্পানি অনুযায়ী), প্রতিটিতে আলাদা **Test** ও **Sync** বোতাম; "Connected x/y" সঠিক; "Sync All Devices" আগের মতো।
- Attendance Devices পেজ: Protocol ডিফল্ট PULL; প্রতি ডিভাইসে Test/Sync/Edit/Map; Status ও Last Activity কলাম।
- **Companies** পেজ (নতুন, শুধু ADMIN): কোম্পানি যোগ/Edit/Activate-Deactivate। সাইডবার ADMINISTRATION-এ "Companies" এবং উপরে Company মেনুর পাশে "+" বোতাম।

## চালানোর ধাপ
1. ব্যাকআপ নিন; নিজের `backend/.env` অক্ষত রাখুন।
2. ফাইলগুলো প্রজেক্টে মার্জ/রিপ্লেস করুন, তারপর Backend ও Frontend রিস্টার্ট করুন (নতুন npm package লাগেনি)।
3. পুরোনো ডিভাইস তুলতে (একবারই):
   ```bash
   cd backend
   npm run import-devices -- GEIL
   ```
   (GEIL = যে কোম্পানির ডিভাইস)। এরপর Attendance Devices পেজে প্রতিটির **IP ঠিক আছে কিনা মিলিয়ে নিন** — config ফাইলে 192.168.0.x ছিল, কিন্তু আগের Attendance কার্ডে 192.168.1.x দেখাত।
4. প্রতিটি ডিভাইসে **Test** চাপুন। ব্যর্থ হলে ত্রুটির নিচে ইঙ্গিত আসবে।

## মনে রাখবেন
- PULL ডিভাইসের জন্য **সার্ভার চালানো কম্পিউটার ও ডিভাইস একই LAN-এ** থাকতে হবে। ক্লাউড/অন্য নেটওয়ার্কে সার্ভার থাকলে PULL কাজ করবে না — তখন ADMS Push ব্যবহার করুন।
- একই ডিভাইস একাধিক কোম্পানিতে যোগ করার দরকার নেই; প্রতিটি ডিভাইস যে কোম্পানির কর্মীদের জন্য, সেই কোম্পানি নির্বাচন করে যোগ করুন।
- এই পরিবেশে MongoDB, npm install বা বাস্তব ZKTeco ডিভাইস ছিল না। Backend ফাইলে `node --check` ও ফ্রন্টএন্ডে বন্ধনী-ভারসাম্য যাচাই হয়েছে; `npm run build` ও বাস্তব ডিভাইসে Test আপনার মেশিনে চালিয়ে দেখতে হবে।
