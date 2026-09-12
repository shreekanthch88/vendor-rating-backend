import express from "express";

import {
  getOrganizationReplacementRequestsController,
  getOrganizationReplacementRequestByIdController,

  createOrganizationReplacementRequestController,
  submitOrganizationReplacementRequestController,
  approveOrganizationReplacementRequestController,
  rejectOrganizationReplacementRequestController,
} from "../controllers/organizationReplacementRequestController.js";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware.js";


const router = express.Router();


// =========================================================
// GET ORGANIZATION REPLACEMENT REQUESTS
// =========================================================
//
// GET
// /api/replacement-requests
//
// Used by:
//
// QUALITY_MANAGER
// PURCHASE_MANAGER
// SUPER_ADMIN
//
// Supports:
//
// ?page=1
// ?limit=10
// ?search=RR000001
// ?status=Pending Approval
// ?vendor=<vendorId>
//
// =========================================================

router.get(
  "/",
  protect,
  authorize(
    "SUPER_ADMIN",
    "PURCHASE_MANAGER",
    "QUALITY_MANAGER"
  ),
  getOrganizationReplacementRequestsController
);


// =========================================================
// GET ORGANIZATION REPLACEMENT REQUEST BY ID
// =========================================================
//
// GET
// /api/replacement-requests/:id
//
// Used for:
//
// Replacement Request Details
// Quality Manager Review
// Audit
//
// =========================================================

router.get(
  "/:id",
  protect,
  authorize(
    "SUPER_ADMIN",
    "PURCHASE_MANAGER",
    "QUALITY_MANAGER"
  ),
  getOrganizationReplacementRequestByIdController
);


// =========================================================
// CREATE REPLACEMENT REQUEST
// =========================================================
//
// POST
// /api/replacement-requests
//
// Creates:
//
// Draft
//
// =========================================================

router.post(
  "/",
  protect,
  authorize(
    "SUPER_ADMIN",
    "PURCHASE_MANAGER",
    "QUALITY_MANAGER"
  ),
  createOrganizationReplacementRequestController
);


// =========================================================
// SUBMIT REPLACEMENT REQUEST
// =========================================================
//
// POST
// /api/replacement-requests/:id/submit
//
// Draft
//   ↓
// Pending Approval
//
// =========================================================

router.post(
  "/:id/submit",
  protect,
  authorize(
    "SUPER_ADMIN",
    "PURCHASE_MANAGER",
    "QUALITY_MANAGER"
  ),
  submitOrganizationReplacementRequestController
);


// =========================================================
// APPROVE REPLACEMENT REQUEST
// =========================================================
//
// POST
// /api/replacement-requests/:id/approve
//
// Pending Approval
//       ↓
//    Approved
//
// =========================================================

router.post(
  "/:id/approve",
  protect,
  authorize(
    "SUPER_ADMIN",
    "PURCHASE_MANAGER",
    "QUALITY_MANAGER"
  ),
  approveOrganizationReplacementRequestController
);


// =========================================================
// REJECT REPLACEMENT REQUEST
// =========================================================
//
// POST
// /api/replacement-requests/:id/reject
//
// Pending Approval
//       ↓
//    Rejected
//
// =========================================================

router.post(
  "/:id/reject",
  protect,
  authorize(
    "SUPER_ADMIN",
    "PURCHASE_MANAGER",
    "QUALITY_MANAGER"
  ),
  rejectOrganizationReplacementRequestController
);


export default router;