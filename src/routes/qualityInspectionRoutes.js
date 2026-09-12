import express from "express";

import {
  getEligibleGoodsReceiptsController,
  getGoodsReceiptForInspectionController,
  createQualityInspectionController,
  getAllQualityInspectionsController,
  getReplacementEligibleQualityInspectionsController,
  getQualityInspectionByIdController,
  updateQualityInspectionController,
  completeQualityInspectionController,
  getPOQualityInspectionHistoryController,
  getVendorQualityInspectionHistoryController,
  getQualityInspectionDashboardSummaryController,
  getQualityInspectionAnalyticsController,
} from "../controllers/qualityInspectionController.js";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware.js";


const router = express.Router();


/**
 * =========================================================
 * QUALITY INSPECTION AUTHORIZATION
 * =========================================================
 */

const qualityInspectionAccess = [
  "SUPER_ADMIN",
  "ADMIN",
  "QUALITY_MANAGER",
  "PURCHASE_MANAGER",
];


/**
 * =========================================================
 * GET ELIGIBLE GOODS RECEIPTS
 * =========================================================
 */

router.get(
  "/eligible-grns",
  protect,
  authorize(...qualityInspectionAccess),
  getEligibleGoodsReceiptsController
);


/**
 * =========================================================
 * GET GRN FOR INSPECTION
 * =========================================================
 */

router.get(
  "/goods-receipts/:goodsReceiptId",
  protect,
  authorize(...qualityInspectionAccess),
  getGoodsReceiptForInspectionController
);


/**
 * =========================================================
 * GET QUALITY INSPECTIONS ELIGIBLE FOR REPLACEMENT
 * =========================================================
 *
 * Completed Quality Inspection
 *          ↓
 * replacementRequired = true
 *          ↓
 * Create Replacement Request
 *
 * GET
 * /api/quality-inspections/replacement-eligible
 */

router.get(
  "/replacement-eligible",
  protect,
  authorize(...qualityInspectionAccess),
  getReplacementEligibleQualityInspectionsController
);


/**
 * =========================================================
 * GET PO QUALITY INSPECTION HISTORY
 * =========================================================
 */

router.get(
  "/history/po/:purchaseOrderId",
  protect,
  authorize(...qualityInspectionAccess),
  getPOQualityInspectionHistoryController
);


/**
 * =========================================================
 * GET VENDOR QUALITY INSPECTION HISTORY
 * =========================================================
 */

router.get(
  "/history/vendor/:vendorId",
  protect,
  authorize(...qualityInspectionAccess),
  getVendorQualityInspectionHistoryController
);


/**
 * =========================================================
 * GET ALL QUALITY INSPECTIONS
 * =========================================================
 */

router.get(
  "/",
  protect,
  authorize(...qualityInspectionAccess),
  getAllQualityInspectionsController
);


/**
 * =========================================================
 * CREATE QUALITY INSPECTION
 * =========================================================
 */

router.post(
  "/",
  protect,
  authorize(...qualityInspectionAccess),
  createQualityInspectionController
);


/**
 * =========================================================
 * UPDATE QUALITY INSPECTION
 * =========================================================
 */

router.put(
  "/:id",
  protect,
  authorize(...qualityInspectionAccess),
  updateQualityInspectionController
);


/**
 * =========================================================
 * GET QUALITY INSPECTION ANALYTICS
 * =========================================================
 */

router.get(
  "/analytics",
  protect,
  authorize(...qualityInspectionAccess),
  getQualityInspectionAnalyticsController
);


/**
 * =========================================================
 * GET QUALITY INSPECTION DASHBOARD SUMMARY
 * =========================================================
 */

router.get(
  "/dashboard-summary",
  protect,
  authorize(...qualityInspectionAccess),
  getQualityInspectionDashboardSummaryController
);


/**
 * =========================================================
 * COMPLETE QUALITY INSPECTION
 * =========================================================
 */

router.patch(
  "/:id/complete",
  protect,
  authorize(...qualityInspectionAccess),
  completeQualityInspectionController
);


/**
 * =========================================================
 * GET QUALITY INSPECTION BY ID
 * =========================================================
 */

router.get(
  "/:id",
  protect,
  authorize(...qualityInspectionAccess),
  getQualityInspectionByIdController
);


export default router;