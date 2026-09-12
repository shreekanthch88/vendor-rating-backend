import { body, validationResult } from "express-validator";

export const vendorValidationRules = [
  body("vendorName")
    .trim()
    .notEmpty()
    .withMessage("Vendor name is required"),

  body("vendorCategory")
    .trim()
    .notEmpty()
    .withMessage("Vendor category is required"),

  body("businessType")
    .trim()
    .notEmpty()
    .withMessage("Business type is required"),

  body("email")
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage("Invalid email address (e.g. name@example.com)"),

  body("mobile")
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 10, max: 10 })
    .withMessage("Mobile must be exactly 10 digits"),

  body("gstNumber")
    .optional({ checkFalsy: true })
    .trim()
    .customSanitizer((val) => (typeof val === "string" ? val.toUpperCase() : val))
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .withMessage(
      "Invalid GST Number. Expected format: 2 digits + 5 letters + 4 numbers + 1 letter + 1 char + Z + 1 char (e.g. 29ABCDE1234F1Z5)"
    ),

  body("panNumber")
    .optional({ checkFalsy: true })
    .trim()
    .customSanitizer((val) => (typeof val === "string" ? val.toUpperCase() : val))
    .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
    .withMessage(
      "Invalid PAN Number. Expected format: 5 letters + 4 numbers + 1 letter (e.g. ABCDE1234F)"
    ),
];

export const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorArray = errors.array();
    const readableMessage = errorArray
      .map((err) => `${err.path || err.param || "Field"}: ${err.msg}`)
      .join("\n");

    return res.status(400).json({
      success: false,
      message: readableMessage || "Validation failed",
      errors: errorArray,
    });
  }

  next();
};