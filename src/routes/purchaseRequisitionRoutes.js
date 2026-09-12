import express from "express";

import {
  createPurchaseRequisitionController,
  getPurchaseRequisitionsController,
  getPurchaseRequisitionByIdController,
  updatePurchaseRequisitionController,
  submitPurchaseRequisitionController,
  approvePurchaseRequisitionController,
  rejectPurchaseRequisitionController,
  deletePurchaseRequisitionController,
  getPurchaseRequisitionDashboardController,
} from "../controllers/purchaseRequisitionController.js";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware.js";

const router = express.Router();

const prApproveRoles = [
  "SUPER_ADMIN",
  "ADMIN",
  "PURCHASE_MANAGER",
];

const prCreateRoles = [
  "SUPER_ADMIN",
  "ADMIN",
  "PURCHASE_MANAGER",
  "QUALITY_MANAGER",
];

const prReadRoles = [
  "SUPER_ADMIN",
  "ADMIN",
  "PURCHASE_MANAGER",
  "QUALITY_MANAGER",
  "FINANCE_MANAGER",
  "VIEWER",
];

/**
 * Dashboard
 */
router.get(
  "/dashboard",
  protect,
  authorize(...prReadRoles),
  getPurchaseRequisitionDashboardController
);

/**
 * Purchase Requisitions
 */
router
  .route("/")
  .post(
    protect,
    authorize(...prCreateRoles),
    createPurchaseRequisitionController
  )
  .get(
    protect,
    authorize(...prReadRoles),
    getPurchaseRequisitionsController
  );

/**
 * Purchase Requisition by ID
 */
router
  .route("/:id")
  .get(
    protect,
    authorize(...prReadRoles),
    getPurchaseRequisitionByIdController
  )
  .put(
    protect,
    authorize(...prCreateRoles),
    updatePurchaseRequisitionController
  )
  .delete(
    protect,
    authorize(...prCreateRoles),
    deletePurchaseRequisitionController
  );

/**
 * Workflow Actions
 */
router.patch(
  "/:id/submit",
  protect,
  authorize(...prCreateRoles),
  submitPurchaseRequisitionController
);

router.patch(
  "/:id/approve",
  protect,
  authorize(...prApproveRoles),
  approvePurchaseRequisitionController
);

router.patch(
  "/:id/reject",
  protect,
  authorize(...prApproveRoles),
  rejectPurchaseRequisitionController
);

export default router;