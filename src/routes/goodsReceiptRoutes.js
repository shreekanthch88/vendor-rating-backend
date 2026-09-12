import express from "express";

import {
  createGoodsReceiptController,
  saveDraftGoodsReceiptController,
  updateGoodsReceiptController,
  submitGoodsReceiptController,
  getAllGoodsReceiptsController,
  getGoodsReceiptByIdController,
  getEligibleDispatchesController,
  getPOReceiptHistoryController,
} from "../controllers/goodsReceiptController.js";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * =========================================================
 * GOODS RECEIPT AUTHORIZATION
 * =========================================================
 *
 * Goods Receipt is an Admin-side procurement operation.
 *
 * Allowed roles:
 * - SUPER_ADMIN
 * - ADMIN
 * - PURCHASE_MANAGER
 *
 * VIEWER can be added later for read-only access if required.
 */

const goodsReceiptAccess = [
  "SUPER_ADMIN",
  "ADMIN",
  "PURCHASE_MANAGER",
];

/**
 * =========================================================
 * GET ELIGIBLE DISPATCHES
 * =========================================================
 *
 * Used by:
 *
 * Admin
 *   ↓
 * Goods Receipt
 *   ↓
 * Create GRN
 *   ↓
 * Select Delivery
 *
 * Only Delivered dispatches should be returned by
 * the service layer.
 */
router.get(
  "/eligible-dispatches",
  protect,
  authorize(...goodsReceiptAccess),
  getEligibleDispatchesController
);


/**
 * =========================================================
 * GET PO RECEIPT HISTORY
 * =========================================================
 *
 * Used for:
 *
 * PO
 *  ↓
 * Dispatch History
 *  ↓
 * GRN History
 */
router.get(
  "/history/po/:purchaseOrderId",
  protect,
  authorize(...goodsReceiptAccess),
  getPOReceiptHistoryController
);


/**
 * =========================================================
 * GET ALL GOODS RECEIPTS
 * =========================================================
 *
 * Supports:
 *
 * ?page=1
 * ?limit=10
 * ?search=GRN-000001
 * ?status=Received
 * ?receiptType=Normal
 */
router.get(
  "/",
  protect,
  authorize(...goodsReceiptAccess),
  getAllGoodsReceiptsController
);


/**
 * =========================================================
 * CREATE GOODS RECEIPT
 * =========================================================
 */
router.post(
  "/",
  protect,
  authorize(...goodsReceiptAccess),
  createGoodsReceiptController
);


/**
 * =========================================================
 * SAVE GOODS RECEIPT AS DRAFT
 * =========================================================
 */
router.post(
  "/draft",
  protect,
  authorize(...goodsReceiptAccess),
  saveDraftGoodsReceiptController
);


/**
 * =========================================================
 * UPDATE DRAFT GOODS RECEIPT
 * =========================================================
 */
router.put(
  "/:id",
  protect,
  authorize(...goodsReceiptAccess),
  updateGoodsReceiptController
);


/**
 * =========================================================
 * SUBMIT DRAFT GOODS RECEIPT
 * =========================================================
 */
router.patch(
  "/:id/submit",
  protect,
  authorize(...goodsReceiptAccess),
  submitGoodsReceiptController
);


/**
 * =========================================================
 * GET GOODS RECEIPT DETAILS
 * =========================================================
 */
router.get(
  "/:id",
  protect,
  authorize(...goodsReceiptAccess),
  getGoodsReceiptByIdController
);


export default router;