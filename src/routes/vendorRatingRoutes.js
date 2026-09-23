import express from "express";

import {
  generateVendorRating,
  getVendorRatings,
  getVendorRatingById,
  getDeliveryCalculation,
  updateEvaluatorScores,
  submitVendorRating,
  approveVendorRating,
  lockVendorRating,
  deleteVendorRating,
  getLatestVendorRating,
  getVendorRatingDashboard,
} from "../controllers/vendorRatingController.js";

import { protect, authorize } from "../middleware/authMiddleware.js";

const router =
  express.Router();


/**
 * =========================================================
 * ROLE GROUPS
 * =========================================================
 *
 * Adjust these according to your existing auth middleware.
 *
 * =========================================================
 */


/**
 * =========================================================
 * GENERATE
 * =========================================================
 */

router.post(
  "/generate",
  protect,
  authorize("SUPER_ADMIN", "ADMIN", "PURCHASE_MANAGER", "QUALITY_MANAGER"),
  generateVendorRating
);


/**
 * =========================================================
 * LIST
 * =========================================================
 */

router.get(
  "/",

  protect,

  getVendorRatings
);


/**
 * =========================================================
 * LATEST
 * =========================================================
 */

router.get(
  "/vendor/:vendorId/latest",

  protect,

  getLatestVendorRating
);


/**
 * =========================================================
 * DASHBOARD
 * =========================================================
 */

router.get(
  "/vendor/:vendorId/dashboard",

  protect,

  getVendorRatingDashboard
);


/**
 * =========================================================
 * DELIVERY CALCULATION (TRANSPARENCY)
 * =========================================================
 */

router.get(
  "/:id/delivery-calculation",

  protect,

  getDeliveryCalculation
);


/**
 * =========================================================
 * SINGLE RATING
 * =========================================================
 */

router.get(
  "/:id",

  protect,

  getVendorRatingById
);


/**
 * =========================================================
 * EVALUATION
 * =========================================================
 */

router.put(
  "/:id/evaluate",
  protect,
  authorize("SUPER_ADMIN", "ADMIN", "PURCHASE_MANAGER", "QUALITY_MANAGER"),
  updateEvaluatorScores
);


/**
 * =========================================================
 * SUBMIT
 * =========================================================
 */

router.post(
  "/:id/submit",
  protect,
  authorize("SUPER_ADMIN", "ADMIN", "PURCHASE_MANAGER", "QUALITY_MANAGER"),
  submitVendorRating
);


/**
 * =========================================================
 * APPROVE
 * =========================================================
 */

router.post(
  "/:id/approve",
  protect,
  authorize("SUPER_ADMIN", "ADMIN"),
  approveVendorRating
);


/**
 * =========================================================
 * LOCK
 * =========================================================
 */

router.post(
  "/:id/lock",
  protect,
  authorize("SUPER_ADMIN", "ADMIN"),
  lockVendorRating
);


/**
 * =========================================================
 * DELETE
 * =========================================================
 */

router.delete(
  "/:id",
  protect,
  authorize("SUPER_ADMIN", "ADMIN"),
  deleteVendorRating
);


export default router;