const express = require("express");
const router = express.Router();

const c = require("../controllers/payrollController");
const { authorize } = require("../middleware/authMiddleware");

// ACCOUNTS: শুধু দেখা ও Excel export (server.js এ readOnlyFor আছে)
router.get("/group-summary", c.groupSummary);
router.get("/", c.getPayroll);
router.get("/export", c.exportExcel);

router.post("/generate", authorize("ADMIN", "HR"), c.generate);
router.patch("/lines/:id", authorize("ADMIN", "HR"), c.editLine);

// Finalize / Paid / Reopen / Delete শুধু ADMIN
router.post("/:month/finalize", authorize("ADMIN"), c.finalize);
router.post("/:month/mark-paid", authorize("ADMIN"), c.markPaid);
router.post("/:month/reopen", authorize("ADMIN"), c.reopen);
router.delete("/:month", authorize("ADMIN"), c.removeRun);

module.exports = router;
