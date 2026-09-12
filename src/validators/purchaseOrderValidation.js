import { body } from "express-validator";

/**
 * ===========================================
 * Create Purchase Order Validation
 * ===========================================
 */

export const createPurchaseOrderValidation = [

  body("purchaseRequisition")
    .notEmpty()
    .withMessage("Purchase Requisition is required.")

    .isMongoId()
    .withMessage("Invalid Purchase Requisition ID."),

  body("vendor")
    .notEmpty()
    .withMessage("Vendor is required.")

    .isMongoId()
    .withMessage("Invalid Vendor ID."),

  body("expectedDeliveryDate")
    .notEmpty()
    .withMessage("Expected Delivery Date is required.")

    .isISO8601()
    .withMessage("Invalid Expected Delivery Date."),

  body("paymentTerms")
    .notEmpty()
    .withMessage("Payment Terms are required."),

  body("deliveryLocation")
    .trim()
    .notEmpty()
    .withMessage("Delivery Location is required."),

  body("priority")
    .optional()
    .isIn([
      "Low",
      "Medium",
      "High",
      "Critical",
    ])
    .withMessage("Invalid Priority."),

  body("currency")
    .optional()
    .isIn([
      "INR",
      "USD",
      "EUR",
    ])
    .withMessage("Invalid Currency."),

  body("buyerRemarks")
    .optional()
    .trim(),

  /**
   * ===========================================
   * Items Validation
   * ===========================================
   */

  body("items")
    .isArray({ min: 1 })
    .withMessage(
      "At least one Purchase Order item is required."
    ),

  body("items.*.material")
    .notEmpty()
    .withMessage("Material is required.")

    .isMongoId()
    .withMessage("Invalid Material ID."),

  body("items.*.materialCode")
    .trim()
    .notEmpty()
    .withMessage("Material Code is required."),

  body("items.*.materialName")
    .trim()
    .notEmpty()
    .withMessage("Material Name is required."),

  body("items.*.quantity")
    .isFloat({ min: 1 })
    .withMessage(
      "Quantity must be greater than zero."
    ),

  body("items.*.unitOfMeasure")
    .trim()
    .notEmpty()
    .withMessage("Unit Of Measure is required."),

  body("items.*.unitPrice")
    .isFloat({ min: 0 })
    .withMessage(
      "Unit Price must be zero or greater."
    ),

  body("items.*.taxPercentage")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage(
      "Tax Percentage must be between 0 and 100."
    ),

  body("items.*.discountPercentage")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage(
      "Discount Percentage must be between 0 and 100."
    ),

  body("items.*.remarks")
    .optional()
    .trim(),

  body("freightCharges")
    .optional()
    .isFloat({ min: 0 })
    .withMessage(
      "Freight Charges cannot be negative."
    ),
];

/**
 * ===========================================
 * Update Purchase Order Validation
 * ===========================================
 */

export const updatePurchaseOrderValidation =
  createPurchaseOrderValidation;