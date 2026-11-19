require("dotenv").config();
const mongoose = require("mongoose");
const Employee = require("../src/models/Employee");

(async () => {
  try {
    if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is missing in backend/.env");
    await mongoose.connect(process.env.MONGODB_URI);
    const collection = Employee.collection;
    await mongoose.connection.db.createCollection(collection.name).catch((error) => {
      if (error.code !== 48) throw error; // NamespaceExists is expected for an existing collection.
    });
    const indexes = await collection.indexes();
    const oldGlobalIndex = indexes.find((index) =>
      index.name === "employeeId_1" ||
      (index.unique && Object.keys(index.key || {}).length === 1 && index.key.employeeId === 1)
    );
    if (oldGlobalIndex) {
      console.log(`Dropping old global employee ID index: ${oldGlobalIndex.name}`);
      await collection.dropIndex(oldGlobalIndex.name);
    }
    await collection.createIndex(
      { company: 1, employeeId: 1 },
      { unique: true, name: "company_employeeId_unique" }
    );
    console.log("Company + Employee ID unique index is ready.");
    console.log("No employee records were deleted or assigned to a company.");
  } catch (error) {
    console.error("Index preparation failed:", error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
