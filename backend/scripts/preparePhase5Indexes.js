require("dotenv").config();
const mongoose = require("mongoose");
const WeeklyRoster = require("../src/models/WeeklyRoster");
const RosterAssignment = require("../src/models/RosterAssignment");
const ShiftRotation = require("../src/models/ShiftRotation");
const Holiday = require("../src/models/Holiday");
const Leave = require("../src/models/Leave");

(async () => {
  try {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri) throw new Error("MONGODB_URI/MONGO_URI missing in backend/.env");
    await mongoose.connect(uri);

    // Drop only the old GLOBAL unique indexes. Existing documents are not deleted.
    for (const [model, oldNames] of [
      [WeeklyRoster, ["weekStartDate_1"]],
      [RosterAssignment, ["employee_1_effectiveFrom_1"]],
    ]) {
      const indexes = await model.collection.indexes();
      for (const index of indexes) {
        if (oldNames.includes(index.name)) {
          await model.collection.dropIndex(index.name);
          console.log(`Dropped old index: ${model.collection.collectionName}.${index.name}`);
        }
      }
    }

    await WeeklyRoster.collection.createIndex(
      { company: 1, weekStartDate: 1 },
      { unique: true, name: "company_1_weekStartDate_1" },
    );
    await RosterAssignment.collection.createIndex(
      { company: 1, employee: 1, effectiveFrom: 1 },
      { unique: true, name: "company_1_employee_1_effectiveFrom_1" },
    );
    await WeeklyRoster.collection.createIndex({ company: 1, "entries.employee": 1 });
    await RosterAssignment.collection.createIndex({ company: 1, employee: 1, effectiveFrom: 1 });
    await ShiftRotation.collection.createIndex({ company: 1, department: 1, isActive: 1 });
    await Holiday.collection.createIndex({ company: 1, date: 1, isActive: 1 });
    await Leave.collection.createIndex({ company: 1, status: 1, fromDate: 1, toDate: 1 });

    console.log("Phase 5 indexes prepared. No employee, roster, leave, holiday or attendance records were deleted.");
    console.log("Legacy roster/assignment records without company are intentionally not auto-assigned.");
  } catch (error) {
    console.error("Phase 5 index preparation failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
