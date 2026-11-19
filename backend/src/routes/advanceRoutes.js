const express = require("express");
const router = express.Router();

const c = require("../controllers/advanceController");
const { authorize } = require("../middleware/authMiddleware");
const cfg = require("../config/advanceConfig");

// server.js এ এই রুট readOnlyFor("ACCOUNTS") এর আগে বসানো, কারণ ACCOUNTS এখানে লিখতে পারে।
// এন্ট্রি: ADMIN / HR / ACCOUNTS   |   অনুমোদন-প্রত্যাখ্যান-ক্লোজ: ADMIN / ACCOUNTS (HR নয়)
router.get("/", c.list);
router.get("/:id", c.getOne);

router.post("/", authorize(...cfg.ENTRY_ROLES), c.create);
router.put("/:id", authorize(...cfg.ENTRY_ROLES), c.update);
router.patch("/:id/cancel", authorize(...cfg.ENTRY_ROLES), c.cancel); // ভেতরে মালিকানা/স্ট্যাটাস যাচাই আছে
router.delete("/:id", authorize(...cfg.ENTRY_ROLES), c.remove);

router.patch("/:id/approve", authorize(...cfg.APPROVER_ROLES), c.approve);
router.patch("/:id/reject", authorize(...cfg.APPROVER_ROLES), c.reject);
router.patch("/:id/close", authorize(...cfg.APPROVER_ROLES), c.close);

module.exports = router;
