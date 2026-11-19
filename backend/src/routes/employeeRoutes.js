const express = require("express");
const { requireCompany } = require("../middleware/companyContext");

const router = express.Router();

// All employee CRUD/import endpoints require an authenticated, authorized company context.
router.use(requireCompany);

const {
  getEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  bulkCreateEmployees,
} = require("../controllers/employeeController");

const {
  validateRequest,
  employeeRules,
  employeeIdRule,
} = require("../validators/employeeValidator");

router.get("/", getEmployees);

router.post("/bulk", bulkCreateEmployees);

router.get("/:id", employeeIdRule, validateRequest, getEmployeeById);

router.post("/", employeeRules, validateRequest, createEmployee);

router.put(
  "/:id",
  [...employeeIdRule, ...employeeRules],
  validateRequest,
  updateEmployee,
);

router.delete("/:id", employeeIdRule, validateRequest, deleteEmployee);

module.exports = router;
