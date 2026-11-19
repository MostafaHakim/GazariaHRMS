const { body, param } = require("express-validator");

exports.designationRules = [
  body("name").trim().notEmpty().withMessage("Designation name is required"),

  body("department")
    .notEmpty()
    .withMessage("Department is required")
    .isMongoId()
    .withMessage("Invalid department ID"),

  body("description").optional({ nullable: true }).trim(),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be boolean"),
];

exports.designationIdRule = [
  param("id").isMongoId().withMessage("Invalid designation ID"),
];
