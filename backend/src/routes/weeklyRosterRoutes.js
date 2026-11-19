const express = require("express");
const router = express.Router();

const {
  getWeeklyRosters,
  generateWeeklyRoster,
  updateRosterEmployeeShift,
  changeShiftMidWeek,
  clearMidWeekChange,
  publishWeeklyRoster,
} = require("../controllers/weeklyRosterController");

// সব Weekly Roster দেখা
router.get("/", getWeeklyRosters);

// নতুন Weekly Roster Generate
router.post("/generate", generateWeeklyRoster);

// নির্দিষ্ট Employee-এর Shift পরিবর্তন
router.put("/:rosterId/employee/:employeeId", updateRosterEmployeeShift);

// সপ্তাহের মাঝখান থেকে শিফট বদল / বদল তুলে নেওয়া
router.put("/:rosterId/employee/:employeeId/mid-week", changeShiftMidWeek);
router.delete("/:rosterId/employee/:employeeId/mid-week", clearMidWeekChange);

// Roster Publish
router.patch("/:rosterId/publish", publishWeeklyRoster);

module.exports = router;
