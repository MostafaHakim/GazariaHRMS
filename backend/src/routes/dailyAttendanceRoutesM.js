const express = require("express");
const router = express.Router();
const { requireCompany } = require("../middleware/companyContext");
router.use(requireCompany);

const {
  runDailyCalculation,
  getDailyAttendance,
  getMonthlyAttendance,
  manualUpdateAttendance,
  getEmployeeJobCard,
  getDepartmentDailySheet,
  getOtLateReport,
} = require("../controllers/dailyAttendanceController");

router.get("/monthly", getMonthlyAttendance);
router.get("/job-card", getEmployeeJobCard);
router.get("/department-sheet", getDepartmentDailySheet);
router.get("/ot-late-report", getOtLateReport);
router.post("/calculate", runDailyCalculation);
router.put("/:id/manual", manualUpdateAttendance);
router.get("/", getDailyAttendance);

module.exports = router;
