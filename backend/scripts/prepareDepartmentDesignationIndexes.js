require("dotenv").config();
const mongoose = require("mongoose");
const Department = require("../src/models/Department");
const Designation = require("../src/models/Designation");

async function dropLegacyUniqueIndexes(collection, keepNames) {
  const indexes = await collection.indexes();
  for (const index of indexes) {
    if (index.name === "_id_" || keepNames.includes(index.name)) continue;
    if (index.unique) {
      console.log(`Dropping legacy unique index: ${index.name}`);
      await collection.dropIndex(index.name);
    }
  }
}

async function run() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing in backend/.env");
  await mongoose.connect(process.env.MONGO_URI);
  const departmentCollection = Department.collection;
  const designationCollection = Designation.collection;
  await dropLegacyUniqueIndexes(departmentCollection, []);
  await dropLegacyUniqueIndexes(designationCollection, []);
  await Department.syncIndexes();
  await Designation.syncIndexes();
  console.log("Company-scoped Department and Designation indexes are ready.");
  console.log("Legacy records without company were preserved and are not visible in company-scoped screens.");
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error("Index preparation failed:", error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
