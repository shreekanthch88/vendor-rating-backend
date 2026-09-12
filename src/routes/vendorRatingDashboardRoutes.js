import express from "express";

import {
  getVendorRatingDashboard,
} from "../controllers/vendorRatingDashboardController.js";

const router = express.Router();

/**
 * =========================================================
 * ADMIN VENDOR RATING DASHBOARD
 * =========================================================
 *
 * GET /api/vendor-rating-dashboard
 *
 * Optional:
 *
 * ?fromDate=2026-08-01
 * &toDate=2026-08-31
 *
 * =========================================================
 */

router.get(
  "/",
  getVendorRatingDashboard
);

export default router;