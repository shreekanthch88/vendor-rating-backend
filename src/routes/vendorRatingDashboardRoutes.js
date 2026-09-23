import express from "express";

import {
  getVendorRatingDashboard,
} from "../controllers/vendorRatingDashboardController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

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
  protect,
  authorize("SUPER_ADMIN", "ADMIN", "PURCHASE_MANAGER", "QUALITY_MANAGER", "VIEWER"),
  getVendorRatingDashboard
);

export default router;