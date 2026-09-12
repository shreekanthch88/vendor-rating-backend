import express from "express";

import {
  getDispatchablePurchaseOrderController,
  getVendorDispatchOverviewController,
  createVendorDispatchController,
  getVendorDispatchesController,
  getVendorDispatchByIdController,
  cancelVendorDispatchController,
  updateVendorDispatchStatusController,
  getPurchaseOrderDispatchHistoryController,
} from "../controllers/vendorDispatchController.js";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * ==========================================================
 * VENDOR DISPATCH ROUTES
 * ==========================================================
 *
 * Base route:
 *
 * /api/vendor/dispatches
 *
 * All routes require:
 *
 * 1. Valid JWT
 * 2. VENDOR role
 *
 * ==========================================================
 */


/**
 * ==========================================================
 * GET DISPATCHABLE PURCHASE ORDER
 * ==========================================================
 *
 * GET
 * /api/vendor/dispatches/purchase-orders/:purchaseOrderId
 *
 * Purpose:
 * Open Create Dispatch page and get:
 *
 * - PO details
 * - Ordered quantity
 * - Previously dispatched quantity
 * - Remaining quantity
 *
 * ==========================================================
 */

router.get(
  "/purchase-orders/:purchaseOrderId",
  protect,
  authorize("VENDOR"),
  getDispatchablePurchaseOrderController
);


/**
 * ==========================================================
 * CREATE DISPATCH
 * ==========================================================
 *
 * POST
 * /api/vendor/dispatches
 *
 * Supports:
 *
 * - Full dispatch
 * - Partial dispatch
 * - Multiple dispatches
 * - Replacement dispatch architecture
 *
 * ==========================================================
 */

router.post(
  "/",
  protect,
  authorize("VENDOR"),
  createVendorDispatchController
);


/**
 * ==========================================================
 * GET ALL VENDOR DISPATCHES
 * ==========================================================
 *
 * GET
 * /api/vendor/dispatches
 *
 * Query parameters:
 *
 * ?page=1
 * ?limit=10
 * ?search=DSP000001
 * ?status=Dispatched
 *
 * ==========================================================
 */

router.get(
  "/",
  protect,
  authorize("VENDOR"),
  getVendorDispatchesController
);


/**
 * ==========================================================
 * GET DISPATCH BY ID
 * ==========================================================
 *
 * GET
 * /api/vendor/dispatches/:id
 *
 * Vendor can only access their own dispatches.
 *
 * ==========================================================
 */


router.get(
  "/overview",
  protect,
  authorize("VENDOR"),
  getVendorDispatchOverviewController
);

router.get(
  "/:id",
  protect,
  authorize("VENDOR"),
  getVendorDispatchByIdController
);


/**
 * ==========================================================
 * CANCEL DRAFT DISPATCH
 * ==========================================================
 *
 * PATCH
 * /api/vendor/dispatches/:id/cancel
 *
 * Only Draft dispatches can be cancelled.
 *
 * ==========================================================
 */

router.patch(
  "/:id/cancel",
  protect,
  authorize("VENDOR"),
  cancelVendorDispatchController
);

router.patch(
  "/:id/status",
  protect,
  authorize("VENDOR"),
  updateVendorDispatchStatusController
);

/**
 * ==========================================================
 * GET PURCHASE ORDER DISPATCH HISTORY
 * ==========================================================
 *
 * GET
 * /api/vendor/dispatches/purchase-orders/:purchaseOrderId/history
 *
 * Returns ALL dispatches for the Purchase Order.
 *
 * Example:
 *
 * DSP000001 → 95
 * DSP000002 → 5
 *
 * ==========================================================
 */

router.get(
  "/purchase-orders/:purchaseOrderId/history",
  protect,
  authorize("VENDOR"),
  getPurchaseOrderDispatchHistoryController
);

export default router;