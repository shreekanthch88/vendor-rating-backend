import asyncHandler from "express-async-handler";

import {
  createReplacementRequest,
  submitReplacementRequest,
  approveReplacementRequest,
  rejectReplacementRequest,
  getOrganizationReplacementRequests,
  getOrganizationReplacementRequestById,
} from "../services/replacementRequestService.js";


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

export const getOrganizationReplacementRequestsController =
  asyncHandler(async (req, res) => {

    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
      vendor = "",
    } = req.query;


    const result =
      await getOrganizationReplacementRequests({

        page,

        limit,

        search,

        status,

        vendor,
      });


    return res.status(200).json({

      success: true,

      message:
        "Replacement requests fetched successfully.",

      ...result,
    });
  });


// =========================================================
// GET ORGANIZATION REPLACEMENT REQUEST BY ID
// =========================================================
//
// GET
// /api/replacement-requests/:id
//
// Used by:
//
// Quality Manager
// Purchase Manager
// Super Admin
//
// =========================================================

export const getOrganizationReplacementRequestByIdController =
  asyncHandler(async (req, res) => {

    const {
      id,
    } = req.params;


    const replacementRequest =
      await getOrganizationReplacementRequestById(
        id
      );


    return res.status(200).json({

      success: true,

      message:
        "Replacement request fetched successfully.",

      data:
        replacementRequest,
    });
  });


// =========================================================
// CREATE REPLACEMENT REQUEST — ORGANIZATION SIDE
// =========================================================
//
// POST
// /api/replacement-requests
//
// Creates a new Replacement Request in:
//
// Draft
//
// =========================================================

export const createOrganizationReplacementRequestController =
  asyncHandler(async (req, res) => {

    const userId =
      req.user._id;


    const {
      purchaseOrderId,
      originalDispatchId,
      qualityInspectionId,
      goodsReceiptId,
      items,
      reason,
      remarks,
      requiredReplacementDate,
    } = req.body;


    // =====================================================
    // BASIC VALIDATION
    // =====================================================

    if (!purchaseOrderId) {

      return res.status(400).json({
        success: false,
        message:
          "Purchase Order ID is required.",
      });

    }


    if (!originalDispatchId) {

      return res.status(400).json({
        success: false,
        message:
          "Original Dispatch ID is required.",
      });

    }


    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {

      return res.status(400).json({
        success: false,
        message:
          "At least one rejected item is required.",
      });

    }


    // =====================================================
    // CREATE
    // =====================================================

    const replacementRequest =
      await createReplacementRequest({

        purchaseOrderId,

        originalDispatchId,

        qualityInspectionId,

        goodsReceiptId,

        items,

        reason,

        remarks,

        requiredReplacementDate,

        requestedBy:
          userId,
      });


    return res.status(201).json({

      success: true,

      message:
        "Replacement request created successfully.",

      data:
        replacementRequest,
    });

  });


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

export const submitOrganizationReplacementRequestController =
  asyncHandler(async (req, res) => {

    const userId =
      req.user._id;


    const {
      id,
    } = req.params;


    const replacementRequest =
      await submitReplacementRequest(
        id,
        userId
      );


    return res.status(200).json({

      success: true,

      message:
        "Replacement request submitted for approval.",

      data:
        replacementRequest,
    });

  });


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

export const approveOrganizationReplacementRequestController =
  asyncHandler(async (req, res) => {

    const userId =
      req.user._id;


    const {
      id,
    } = req.params;


    const {
      approvalRemarks = "",
    } = req.body;


    const replacementRequest =
      await approveReplacementRequest(
        id,
        userId,
        approvalRemarks
      );


    return res.status(200).json({

      success: true,

      message:
        "Replacement request approved successfully.",

      data:
        replacementRequest,
    });

  });


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

export const rejectOrganizationReplacementRequestController =
  asyncHandler(async (req, res) => {

    const userId =
      req.user._id;


    const {
      id,
    } = req.params;


    const {
      rejectionReason = "",
    } = req.body;


    if (
      !rejectionReason ||
      !rejectionReason.trim()
    ) {

      return res.status(400).json({

        success: false,

        message:
          "Rejection reason is required.",

      });

    }


    const replacementRequest =
      await rejectReplacementRequest(
        id,
        userId,
        rejectionReason
      );


    return res.status(200).json({

      success: true,

      message:
        "Replacement request rejected.",

      data:
        replacementRequest,
    });

  });