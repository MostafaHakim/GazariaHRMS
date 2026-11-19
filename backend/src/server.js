require("dotenv").config();
const PORT = process.env.PORT;
const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");
const employeeRoutes = require("./routes/employeeRoutes");
const departmentRoutes = require("./routes/departmentRoutes");
const designationRoutes = require("./routes/designationRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const shiftRoutes = require("./routes/shiftRoutes");
const weeklyRosterRoutes = require("./routes/weeklyRosterRoutes");
const rosterPlanRoutes = require("./routes/rosterPlanRoutes");
const dailyAttendanceRoutes = require("./routes/dailyAttendanceRoutes");
const holidayRoutes = require("./routes/holidayRoutes");
const leaveRoutes = require("./routes/leaveRoutes");
const admsRoutes = require("./routes/admsRoutes");
const authRoutes = require("./routes/authRoutes");
const payrollRoutes = require("./routes/payrollRoutes");
const advanceRoutes = require("./routes/advanceRoutes");
const companyRoutes = require("./routes/companyRoutes");
const deviceRoutes = require("./routes/deviceRoutes");
const financeRoutes = require("./routes/financeRoutes");
const groupRoutes = require("./routes/groupRoutes");
const userAccessRoutes = require("./routes/userAccessRoutes");

const {
  protect,
  readOnlyFor,
  getSecret,
} = require("./middleware/authMiddleware");
const { requireCompany } = require("./middleware/companyContext");
const {
  ensureInitialAdmin,
  ensureInitialCompanies,
} = require("./services/bootstrapService");

const errorMiddleware = require("./middleware/errorMiddleware");
const { startCronJobs } = require("./services/cronService");

const app = express();

// FRONTEND_URL এ কমা দিয়ে একাধিক ঠিকানা দেওয়া যায়, যেমন:
// FRONTEND_URL=http://localhost:5173,http://192.168.0.50:5173
// localhost ও 127.0.0.1 দুটোই নিজে থেকে অনুমোদিত (অনেকে ব্রাউজারে 127.0.0.1 দিয়ে খোলেন)
const allowedOrigins = process.env.FRONTEND_URL.split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter(Boolean);

for (const o of [...allowedOrigins]) {
  if (o.includes("//localhost"))
    allowedOrigins.push(o.replace("//localhost", "//127.0.0.1"));
  else if (o.includes("//127.0.0.1"))
    allowedOrigins.push(o.replace("//127.0.0.1", "//localhost"));
}

app.use(
  cors({
    origin: (origin, callback) => {
      // origin না থাকলে (curl/Postman/সার্ভার-টু-সার্ভার) অনুমোদন
      if (!origin || allowedOrigins.includes(origin))
        return callback(null, true);
      console.warn(
        `CORS blocked origin: ${origin}  (allowed: ${allowedOrigins.join(", ")}) — .env এর FRONTEND_URL এ যোগ করুন`,
      );
      return callback(null, false);
    },
  }),
);

app.use(express.json({ limit: "2mb" }));

// ZKTeco ADMS sends plain-text/tab-separated payloads, not JSON.
app.use("/iclock", express.text({ type: "*/*", limit: "5mb" }), admsRoutes);

// Test API
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Gazaria HRMS API Running",
    version: "2.0.0",
  });
});

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    database: "Connected",
    timestamp: new Date(),
  });
});

// Auth (login খোলা; বাকি রুটগুলো প্রতিটি নিজে protect করে)
app.use("/api/auth", authRoutes);

// এর পর থেকে সব /api রুটে লগইন লাগবে
app.use("/api", protect);

// Advance & Loan: ACCOUNTS এখানে এন্ট্রি/অনুমোদন করতে পারে, তাই read-only নিয়মের আগে বসানো
// (রোল অনুযায়ী অনুমতি advanceRoutes নিজেই দেখে)
app.use("/api/companies", companyRoutes);
app.use("/api/group", groupRoutes);
app.use("/api/users", userAccessRoutes);
app.use("/api/finance", requireCompany, financeRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/advances", requireCompany, advanceRoutes);

// বাকি সব রুটে ACCOUNTS রোল শুধু দেখতে পারবে (GET)
app.use("/api", readOnlyFor("ACCOUNTS"));

// Employee Routes
app.use("/api/employees", employeeRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/designations", designationRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/shifts", shiftRoutes);
app.use("/api/weekly-rosters", requireCompany, weeklyRosterRoutes);
app.use("/api/roster-plans", requireCompany, rosterPlanRoutes);
app.use("/api/daily-attendance", dailyAttendanceRoutes);
app.use("/api/holidays", requireCompany, holidayRoutes);
app.use("/api/leaves", requireCompany, leaveRoutes);
app.use("/api/payroll", requireCompany, payrollRoutes);

// Error Handler — must be after routes
app.use(errorMiddleware);

// Start Server

const startServer = async () => {
  try {
    getSecret(); // JWT_SECRET না থাকলে এখানেই থেমে যাবে
    await connectDB();
    await ensureInitialCompanies();
    await ensureInitialAdmin();

    // app.listen(PORT, "0.0.0.0", () => {
    //   console.log(`Gazaria HRMS running on port ${PORT}`);
    //   // Start background jobs after server is up
    //   try {
    //     startCronJobs();
    //   } catch (cronErr) {
    //     console.error("Cron start failed:", cronErr.message);
    //   }
    // });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;
