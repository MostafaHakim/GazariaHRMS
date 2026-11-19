// ব্যবহার:  npm run create-admin -- <username> <password> "<Full Name>"
// অথবা .env এ ADMIN_USERNAME / ADMIN_PASSWORD দিলে সার্ভার চালুর সময় প্রথম ADMIN নিজে তৈরি হবে।
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/User");

(async () => {
  const [username, password, ...nameParts] = process.argv.slice(2);
  if (!username || !password) {
    console.error('Usage: npm run create-admin -- <username> <password> "<Full Name>"');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const existing = await User.findOne({ username: username.toLowerCase() });

  if (existing) {
    existing.password = password;
    existing.role = "ADMIN";
    existing.isActive = true;
    await existing.save();
    console.log(`Updated existing user "${existing.username}" as ADMIN with new password`);
  } else {
    await User.create({
      name: nameParts.join(" ") || "Administrator",
      username,
      role: "ADMIN",
      password,
    });
    console.log(`ADMIN user "${username}" created`);
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
