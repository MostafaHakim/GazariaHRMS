const { body, param, validationResult } = require("express-validator");

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array(),
    });
  }

  next();
};

const employeeRules = [
  body("employeeId").trim().notEmpty().withMessage("Employee ID is required"),

  body("name").trim().notEmpty().withMessage("Employee name is required"),

  body("joiningDate")
    .notEmpty()
    .withMessage("Joining date is required")
    .isISO8601()
    .withMessage("Invalid joining date"),

  body("grossSalary")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Gross salary must be a positive number"),

  body("basicSalary")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Basic salary must be a positive number"),

  body("employmentStatus")
    .optional()
    .isIn(["Active", "Inactive", "Resigned", "Terminated"])
    .withMessage("Invalid employment status"),
];

const employeeIdRule = [
  param("id").isMongoId().withMessage("Invalid employee ID"),
];

module.exports = {
  validateRequest,
  employeeRules,
  employeeIdRule,
};
