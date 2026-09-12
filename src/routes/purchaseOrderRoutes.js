import express from "express";

import {
  createPurchaseOrderController,
  getPurchaseOrdersController,
  getPurchaseOrderByIdController,
  updatePurchaseOrderController,
  deletePurchaseOrderController,
  submitPurchaseOrderController,
  approvePurchaseOrderController,
  rejectPurchaseOrderController,
  sendPurchaseOrderToVendorController,
  vendorAcceptPurchaseOrderController,
  vendorRejectPurchaseOrderController,
  getPurchaseOrderDashboardController,
  getPurchaseOrderChartsController,
  getPurchaseOrderFulfillmentController,
} from "../controllers/purchaseOrderController.js";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware.js";

import validate from "../middleware/validate.js";

import {
  createPurchaseOrderValidation,
  updatePurchaseOrderValidation,
} from "../validators/purchaseOrderValidation.js";

const router = express.Router();

/**
 * ===========================================
 * Authorization Roles
 * ===========================================
 */
const poManageRoles = [
  "SUPER_ADMIN",
  "ADMIN",
  "PURCHASE_MANAGER",
];

const poReadRoles = [
  "SUPER_ADMIN",
  "ADMIN",
  "PURCHASE_MANAGER",
  "QUALITY_MANAGER",
  "FINANCE_MANAGER",
  "VIEWER",
];

/**
 * ===========================================
 * Dashboard
 * ===========================================
 */

router.get(
  "/dashboard",
  protect,
  authorize(...poReadRoles),
  getPurchaseOrderDashboardController
);

router.get(
  "/charts",
  protect,
  authorize(...poReadRoles),
  getPurchaseOrderChartsController
);

/**
 * ===========================================
 * Purchase Order CRUD
 * ===========================================
 */

router
  .route("/")
  .get(
    protect,
    authorize(...poReadRoles),
    getPurchaseOrdersController
  )
  .post(
    protect,
    authorize(...poManageRoles),
    createPurchaseOrderValidation,
    validate,
    createPurchaseOrderController
  );

router
  .route("/:id")
  .get(
    protect,
    authorize(...poReadRoles),
    getPurchaseOrderByIdController
  )
  .put(
    protect,
    authorize(...poManageRoles),
    updatePurchaseOrderValidation,
    validate,
    updatePurchaseOrderController
  )
  .delete(
    protect,
    authorize(...poManageRoles),
    deletePurchaseOrderController
  );

/**
 * ===========================================
 * Workflow
 * ===========================================
 */

router.patch(
  "/:id/submit",
  protect,
  authorize(...poManageRoles),
  submitPurchaseOrderController
);

router.patch(
  "/:id/approve",
  protect,
  authorize(...poManageRoles),
  approvePurchaseOrderController
);

router.patch(
  "/:id/reject",
  protect,
  authorize(...poManageRoles),
  rejectPurchaseOrderController
);

router.patch(
  "/:id/send",
  protect,
  authorize(...poManageRoles),
  sendPurchaseOrderToVendorController
);

/**
 * ===========================================
 * Vendor Actions
 * ===========================================
 */

router.patch(
  "/:id/vendor-accept",
  protect,
  authorize("VENDOR"),
  vendorAcceptPurchaseOrderController
);

router.patch(
  "/:id/vendor-reject",
  protect,
  authorize("VENDOR"),
  vendorRejectPurchaseOrderController
);

/**
 * ===========================================
 * PURCHASE ORDER FULFILLMENT
 * ===========================================
 *
 * GET
 * /api/purchase-orders/:id/fulfillment
 *
 * Returns:
 *
 * - Ordered quantity
 * - Original dispatched quantity
 * - Original received quantity
 * - Original accepted quantity
 * - Original rejected quantity
 * - Original damaged quantity
 * - Original short quantity
 * - Replacement quantities
 * - Final fulfilled quantity
 * - Final pending quantity
 * - Fulfillment percentage
 *
 * Only accepted quantities are counted as
 * final fulfillment.
 *
 * ===========================================
 */

router.get(
  "/:id/fulfillment",
  protect,
  authorize(
    "SUPER_ADMIN",
    "ADMIN",
    "PURCHASE_MANAGER",
    "QUALITY_MANAGER"
  ),
  getPurchaseOrderFulfillmentController
);

export default router;