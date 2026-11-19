const express = require("express");
const router = express.Router();
const c = require("../controllers/rosterPlanController");

router.get("/preview", c.preview);
router.post("/assign", c.assign);
router.post("/generate", c.generate);
router.post("/publish", c.publishRange);
router.put("/override", c.override);

module.exports = router;
