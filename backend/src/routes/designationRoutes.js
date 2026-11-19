const express = require("express");
const router = express.Router();
const { requireCompany } = require("../middleware/companyContext");
router.use(requireCompany);

const {
  getDesignations,
  createDesignation,
  updateDesignation,
  deleteDesignation,
} = require("../controllers/designationController");

const {
  designationRules,
  designationIdRule,
} = require("../validators/designationValidator");

const validateRequest = require("../middleware/validateRequest");

router.get("/", getDesignations);

router.post("/", designationRules, validateRequest, createDesignation);

router.put(
  "/:id",
  [...designationIdRule, ...designationRules],
  validateRequest,
  updateDesignation,
);

router.delete("/:id", designationIdRule, validateRequest, deleteDesignation);

module.exports = router;
