const { body, param } = require("express-validator");

exports.departmentRules = [
  body("name").trim().notEmpty().withMessage("Department name is required"),

  body("code")
    .trim()
    .notEmpty()
    .withMessage("Department code is required")
    .isLength({ max: 20 })
    .withMessage("Department code is too long"),

  body("description").optional({ nullable: true }).trim(),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be boolean"),
];

exports.departmentIdRule = [
  param("id").isMongoId().withMessage("Invalid department ID"),
];
