const User = require("../models/User");
const Company = require("../models/Company");

const INITIAL_COMPANIES = [
  { name: "Gazaria Elastic Industries Limited", code: "GEIL" },
  { name: "Gazaria Accessories Limited", code: "GAL" },
  { name: "Megabox Limited", code: "MEGABOX" },
];

const ensureInitialCompanies = async () => {
  for (const company of INITIAL_COMPANIES) {
    await Company.updateOne({ code: company.code }, { $setOnInsert: company }, { upsert: true });
  }
};

// কোনো ইউজার না থাকলে .env এর ADMIN_USERNAME / ADMIN_PASSWORD থেকে প্রথম ADMIN তৈরি করে।
const ensureInitialAdmin = async () => {
  const count = await User.estimatedDocumentCount();
  if (count > 0) return;

  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.warn(
      "No users exist. Set ADMIN_USERNAME & ADMIN_PASSWORD in .env or run: npm run create-admin -- <username> <password>",
    );
    return;
  }

  await User.create({
    name: process.env.ADMIN_NAME || "Administrator",
    username,
    password,
    role: "ADMIN",
  });
  console.log(`Initial ADMIN "${username}" created. Remove ADMIN_PASSWORD from .env now.`);
};

module.exports = { ensureInitialAdmin, ensureInitialCompanies };
