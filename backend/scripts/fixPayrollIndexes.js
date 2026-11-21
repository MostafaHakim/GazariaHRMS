// ব্যবহার:  node scripts/fixPayrollIndexes.js          (শুধু দেখাবে)
//           node scripts/fixPayrollIndexes.js --apply   (পুরনো ভুল unique index মুছবে)
const mongoose = require("mongoose");
require("dotenv").config();

const APPLY = process.argv.includes("--apply");

// কোন কালেকশনে কোন ফিল্ড থাকা বাধ্যতামূলক (না থাকলে unique index টি মাল্টি-কোম্পানিতে ভুল)
const RULES = {
  payrollruns: "company",
  payrolllines: "run",
};

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const db = mongoose.connection.db;

  for (const [name, mustHave] of Object.entries(RULES)) {
    const col = db.collection(name);
    const indexes = await col.indexes();
    console.log(`\n== ${name} ==`);
    for (const ix of indexes) {
      const keys = Object.keys(ix.key);
      const bad = ix.unique && ix.name !== "_id_" && !keys.includes(mustHave);
      console.log(`${bad ? "❌ ভুল" : "✅"}  ${ix.name}  ${JSON.stringify(ix.key)}  unique=${!!ix.unique}`);
      if (bad && APPLY) {
        await col.dropIndex(ix.name);
        console.log(`   → মুছে ফেলা হয়েছে: ${ix.name}`);
      }
    }
  }

  if (APPLY) {
    await db.collection("payrollruns").createIndex(
      { company: 1, month: 1 },
      { unique: true, name: "company_payroll_month_unique" },
    );
    console.log("\ncompany+month unique index নিশ্চিত করা হয়েছে।");
  } else {
    console.log("\nকিছু বদলানো হয়নি। ঠিক করতে --apply দিয়ে চালান।");
  }
  await mongoose.disconnect();
};

run().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
