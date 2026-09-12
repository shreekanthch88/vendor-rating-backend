import express from "express";

import {
  getVendorPurchaseOrdersController,
  getVendorPurchaseOrderByIdController,
  acceptVendorPurchaseOrderController,
  rejectVendorPurchaseOrderController,
} from "../controllers/vendorPurchaseOrderController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * ===========================================
 * Vendor Purchase Orders
 * ===========================================
 */

/**
 * Get Vendor Purchase Orders
 * GET /api/vendor/purchase-orders
 */
router.get(
  "/",
  protect,
  getVendorPurchaseOrdersController
);

/**
 * Get Vendor Purchase Order By ID
 * GET /api/vendor/purchase-orders/:id
 */
router.get(
  "/:id",
  protect,
  getVendorPurchaseOrderByIdController
);

/**
 * ===========================================
 * Vendor PO Actions
 * ===========================================
 */

/**
 * Accept Purchase Order
 * PATCH /api/vendor/purchase-orders/:id/accept
 */
router.patch(
  "/:id/accept",
  protect,
  acceptVendorPurchaseOrderController
);

/**
 * Reject Purchase Order
 * PATCH /api/vendor/purchase-orders/:id/reject
 */
router.patch(
  "/:id/reject",
  protect,
  rejectVendorPurchaseOrderController
);

export default router;