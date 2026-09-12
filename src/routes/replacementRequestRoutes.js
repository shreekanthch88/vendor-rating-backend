import express from "express";

import {
  // =======================================================
  // QUALITY MANAGER / ORGANIZATION CONTROLLERS
  // =======================================================

  createReplacementRequestController,
  submitReplacementRequestController,
  approveReplacementRequestController,
  rejectReplacementRequestController,

  // =======================================================
  // VENDOR CONTROLLERS
  // =======================================================

  getVendorReplacementRequestsController,
  getVendorReplacementRequestByIdController,
  getReplacementDispatchHistoryController,
  acceptReplacementRequestController,
  linkReplacementDispatchController,

} from "../controllers/replacementRequestController.js";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware.js";


const router = express.Router();


// =========================================================
// QUALITY MANAGER / ORGANIZATION REPLACEMENT ROUTES
// =========================================================
//
// These routes are used by the Quality Manager workflow:
//
// Quality Inspection
//        ↓
// Replacement Decision
//        ↓
// Replacement Request
//        ↓
// Submit
//        ↓
// Approval / Rejection
//
// IMPORTANT:
//
// These paths are intentionally preserved exactly as your
// existing implementation uses them.
//
// =========================================================


// =========================================================
// CREATE REPLACEMENT REQUEST
// =========================================================
//
// POST
// /api/vendor/replacement-requests/quality-inspections/replacement-requests
//
// NOTE:
// This route is preserved from your existing file.
// Organization-side normal routes are separately mounted
// through organizationReplacementRequestRoutes.js.
//
// =========================================================

router.post(
  "/quality-inspections/replacement-requests",
  protect,
  authorize(
    "SUPER_ADMIN",
    "QUALITY_MANAGER",
    "PURCHASE_MANAGER"
  ),
  createReplacementRequestController
);


// =========================================================
// SUBMIT REPLACEMENT REQUEST
// =========================================================
//
// PATCH
// /api/vendor/replacement-requests/
// quality-inspections/replacement-requests/:id/submit
//
// =========================================================

router.patch(
  "/quality-inspections/replacement-requests/:id/submit",
  protect,
  authorize(
    "SUPER_ADMIN",
    "QUALITY_MANAGER",
    "PURCHASE_MANAGER"
  ),
  submitReplacementRequestController
);


// =========================================================
// APPROVE REPLACEMENT REQUEST
// =========================================================
//
// PATCH
// /api/vendor/replacement-requests/
// quality-inspections/replacement-requests/:id/approve
//
// Pending Approval
//       ↓
//    Approved
//
// =========================================================

router.patch(
  "/quality-inspections/replacement-requests/:id/approve",
  protect,
  authorize(
    "SUPER_ADMIN",
    "QUALITY_MANAGER",
    "PURCHASE_MANAGER"
  ),
  approveReplacementRequestController
);


// =========================================================
// REJECT REPLACEMENT REQUEST
// =========================================================
//
// PATCH
// /api/vendor/replacement-requests/
// quality-inspections/replacement-requests/:id/reject
//
// Pending Approval
//       ↓
//    Rejected
//
// =========================================================

router.patch(
  "/quality-inspections/replacement-requests/:id/reject",
  protect,
  authorize(
    "SUPER_ADMIN",
    "QUALITY_MANAGER",
    "PURCHASE_MANAGER"
  ),
  rejectReplacementRequestController
);


// =========================================================
// VENDOR REPLACEMENT REQUEST ROUTES
// =========================================================
//
// IMPORTANT:
//
// app.js already mounts this router at:
//
// /api/vendor/replacement-requests
//
// Therefore these Vendor routes MUST be relative:
//
// "/"       → /api/vendor/replacement-requests
//
// "/:id"    → /api/vendor/replacement-requests/:id
//
// "/:id/accept"
//           → /api/vendor/replacement-requests/:id/accept
//
// =========================================================


// =========================================================
// GET VENDOR REPLACEMENT REQUESTS
// =========================================================
//
// GET
// /api/vendor/replacement-requests
//
// Used by:
//
// Vendor
//   ↓
// Replacement
//   ↓
// Replacement Requests
//
// =========================================================

router.get(
  "/",
  protect,
  authorize("VENDOR"),
  getVendorReplacementRequestsController
);


// =========================================================
// GET REPLACEMENT DISPATCH HISTORY
// =========================================================
//
// GET
// /api/vendor/replacement-requests/:id/dispatch-history
//
// IMPORTANT:
//
// This route is placed BEFORE "/:id" so Express does not
// incorrectly treat "dispatch-history" as an ID.
//
// =========================================================

router.get(
  "/:id/dispatch-history",
  protect,
  authorize("VENDOR"),
  getReplacementDispatchHistoryController
);


// =========================================================
// ACCEPT REPLACEMENT REQUEST
// =========================================================
//
// PATCH
// /api/vendor/replacement-requests/:id/accept
//
// Workflow:
//
// Approved
//    ↓
// Vendor Views Request
//    ↓
// Vendor Accepts
//    ↓
// Vendor Accepted
//    ↓
// Existing Dispatch Module
//
// =========================================================

router.patch(
  "/:id/accept",
  protect,
  authorize("VENDOR"),
  acceptReplacementRequestController
);


// =========================================================
// LINK REPLACEMENT DISPATCH
// =========================================================
//
// PATCH
// /api/vendor/replacement-requests/:id/dispatch
//
// This is used after the vendor creates a replacement
// dispatch using the existing Vendor Dispatch module.
//
// =========================================================

router.patch(
  "/:id/dispatch",
  protect,
  authorize("VENDOR"),
  linkReplacementDispatchController
);


// =========================================================
// GET VENDOR REPLACEMENT REQUEST BY ID
// =========================================================
//
// GET
// /api/vendor/replacement-requests/:id
//
// IMPORTANT:
//
// Keep this AFTER the specific routes:
//
// /:id/dispatch-history
// /:id/accept
// /:id/dispatch
//
// =========================================================

router.get(
  "/:id",
  protect,
  authorize("VENDOR"),
  getVendorReplacementRequestByIdController
);


export default router;