// পুরোনো src/config/devices.js-এর ডিভাইসগুলো একটি কোম্পানিতে PULL ডিভাইস হিসেবে তোলে।
// ব্যবহার: npm run import-devices -- GEIL        (GEIL = Company code)
require("dotenv").config();
const mongoose = require("mongoose");
const Company = require("../src/models/Company");
const Device = require("../src/models/Device");
const legacy = require("../src/config/devices");

(async () => {
  const code = String(process.argv[2] || "").trim().toUpperCase();
  if (!code) {
    console.error("Company code দিন। যেমন: npm run import-devices -- GEIL");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const company = await Company.findOne({ code });
  if (!company) {
    console.error(`"${code}" কোডের কোনো কোম্পানি পাওয়া যায়নি`);
    process.exit(1);
  }
  for (const d of legacy) {
    await Device.updateOne(
      { company: company._id, deviceId: String(d.deviceId).toUpperCase() },
      {
        $setOnInsert: {
          company: company._id,
          deviceId: String(d.deviceId).toUpperCase(),
          name: d.name,
          model: d.model || "",
          ip: d.ip,
          port: d.port || 4370,
          commKey: d.commKey ?? 0,
          protocol: "PULL",
          enabled: d.enabled !== false,
        },
      },
      { upsert: true },
    );
    console.log(`✔ ${d.deviceId} (${d.ip}) → ${company.name}`);
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
