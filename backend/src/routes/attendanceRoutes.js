const express = require("express");

const router = express.Router();
const { requireCompany } = require("../middleware/companyContext");
router.use(requireCompany);

const {
  getAttendanceLogs,
  getLogFilterOptions,
  getDeviceSyncHistory,
  syncAttendanceFromDevices,
} = require("../controllers/attendanceController");

router.get("/logs", getAttendanceLogs);

// Device / Section / Department ফিল্টার অপশন
router.get("/filter-options", getLogFilterOptions);

router.get("/sync-history", getDeviceSyncHistory);

// Manual Attendance Sync
router.post("/sync", syncAttendanceFromDevices);

module.exports = router;
