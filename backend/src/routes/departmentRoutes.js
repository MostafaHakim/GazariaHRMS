const express = require("express");
const router = express.Router();
const { requireCompany } = require("../middleware/companyContext");
router.use(requireCompany);

const {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} = require("../controllers/departmentController");

const {
  departmentRules,
  departmentIdRule,
} = require("../validators/departmentValidator");

const validateRequest = require("../middleware/validateRequest");

router.get("/", getDepartments);

router.get("/:id", departmentIdRule, validateRequest, getDepartmentById);

router.post("/", departmentRules, validateRequest, createDepartment);

router.put(
  "/:id",
  [...departmentIdRule, ...departmentRules],
  validateRequest,
  updateDepartment,
);

router.delete("/:id", departmentIdRule, validateRequest, deleteDepartment);

module.exports = router;
