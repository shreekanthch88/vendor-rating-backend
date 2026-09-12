import asyncHandler from "express-async-handler";

import {
  createReplacementRequest,
  submitReplacementRequest,
  approveReplacementRequest,
  rejectReplacementRequest,

  getOrganizationReplacementRequests,
  getOrganizationReplacementRequestById,

  getVendorReplacementRequests,
  getVendorReplacementRequestById,
  getReplacementDispatchHistory,
  acceptReplacementRequest,
  linkReplacementDispatch,
  createReReplacementRequest,
} from "../services/replacementRequestService.js";


// =========================================================
// HELPER — GET VENDOR ID
// =========================================================

const getVendorId = (req) => {

  if (!req.user) {

    const error = new Error(
      "Authentication required."
    );

    error.statusCode = 401;

    throw error;
  }


  if (!req.user.vendor) {

    const error = new Error(
      "Vendor account is not associated with this user."
    );

    error.statusCode = 403;

    throw error;
  }


  return req.user.vendor._id
    ? req.user.vendor._id
    : req.user.vendor;
};


// =========================================================
// HELPER — GET USER ID
// =========================================================

const getUserId = (req) => {

  if (!req.user) {

    const error = new Error(
      "Authentication required."
    );

    error.statusCode = 401;

    throw error;
  }


  return req.user._id;
};


// =========================================================
// QUALITY MANAGER
// GET ORGANIZATION REPLACEMENT REQUESTS
// =========================================================
//
// GET
// /api/quality-inspections/replacement-requests
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
// QUALITY MANAGER
// GET ORGANIZATION REPLACEMENT REQUEST BY ID
// =========================================================
//
// GET
// /api/quality-inspections/replacement-requests/:id
//
// =========================================================

export const getOrganizationReplacementRequestByIdController =
  asyncHandler(async (req, res) => {

    const {
      id,
    } = req.params;


    const request =
      await getOrganizationReplacementRequestById(
        id
      );


    return res.status(200).json({

      success: true,

      message:
        "Replacement request fetched successfully.",

      data:
        request,
    });
  });


// =========================================================
// CREATE REPLACEMENT REQUEST
// =========================================================
//
// POST
// /api/quality-inspections/replacement-requests
//
// Quality Manager creates a replacement request from
// Quality Inspection / Replacement Decision.
//
// =========================================================

export const createReplacementRequestController =
  asyncHandler(async (req, res) => {

    const userId =
      getUserId(req);


    const {
      purchaseOrderId,
      originalDispatchId,
      qualityInspectionId = null,
      goodsReceiptId = null,
      items,
      reason = "",
      remarks = "",
      requiredReplacementDate = null,
    } = req.body;


    const request =
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
        request,
    });
  });


// =========================================================
// SUBMIT REPLACEMENT REQUEST
// =========================================================
//
// PATCH
// /api/quality-inspections/replacement-requests/:id/submit
//
// Draft
//   ↓
// Pending Approval
//
// =========================================================

export const submitReplacementRequestController =
  asyncHandler(async (req, res) => {

    const userId =
      getUserId(req);


    const {
      id,
    } = req.params;


    const request =
      await submitReplacementRequest(

        id,

        userId
      );


    return res.status(200).json({

      success: true,

      message:
        "Replacement request submitted for approval.",

      data:
        request,
    });
  });


// =========================================================
// APPROVE REPLACEMENT REQUEST
// =========================================================
//
// PATCH
// /api/quality-inspections/replacement-requests/:id/approve
//
// Pending Approval
//        ↓
// Approved
//
// =========================================================

export const approveReplacementRequestController =
  asyncHandler(async (req, res) => {

    const userId =
      getUserId(req);


    const {
      id,
    } = req.params;


    const {
      approvalRemarks = "",
    } = req.body;


    const request =
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
        request,
    });
  });


// =========================================================
// REJECT REPLACEMENT REQUEST
// =========================================================
//
// PATCH
// /api/quality-inspections/replacement-requests/:id/reject
//
// Pending Approval
//        ↓
// Rejected
//
// =========================================================

export const rejectReplacementRequestController =
  asyncHandler(async (req, res) => {

    const userId =
      getUserId(req);


    const {
      id,
    } = req.params;


    const {
      rejectionReason = "",
    } = req.body;


    const request =
      await rejectReplacementRequest(

        id,

        userId,

        rejectionReason
      );


    return res.status(200).json({

      success: true,

      message:
        "Replacement request rejected successfully.",

      data:
        request,
    });
  });


// =========================================================
// GET VENDOR REPLACEMENT REQUESTS
// =========================================================
//
// GET
// /api/vendor/replacement-requests
//
// Vendor can see only their own replacement requests.
//
// =========================================================

export const getVendorReplacementRequestsController =
  asyncHandler(async (req, res) => {

    const vendorId =
      getVendorId(req);


    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
    } = req.query;


    const result =
      await getVendorReplacementRequests({

        vendorId,

        page,

        limit,

        search,

        status,
      });


    return res.status(200).json({

      success: true,

      ...result,
    });
  });


// =========================================================
// GET VENDOR REPLACEMENT REQUEST BY ID
// =========================================================
//
// GET
// /api/vendor/replacement-requests/:id
//
// =========================================================

export const getVendorReplacementRequestByIdController =
  asyncHandler(async (req, res) => {

    const vendorId =
      getVendorId(req);


    const {
      id,
    } = req.params;


    const request =
      await getVendorReplacementRequestById(

        id,

        vendorId
      );


    return res.status(200).json({

      success: true,

      data:
        request,
    });
  });


// =========================================================
// R1.5-B.6
// GET REPLACEMENT DISPATCH HISTORY
// =========================================================
//
// GET
// /api/vendor/replacement-requests/:id/dispatch-history
//
// =========================================================

export const getReplacementDispatchHistoryController =
  asyncHandler(async (req, res) => {

    const vendorId =
      getVendorId(req);


    const {
      id,
    } = req.params;


    const result =
      await getReplacementDispatchHistory(

        id,

        vendorId
      );


    return res.status(200).json({

      success: true,

      data:
        result,
    });
  });


// =========================================================
// ACCEPT REPLACEMENT REQUEST
// =========================================================
//
// PATCH
// /api/vendor/replacement-requests/:id/accept
//
// Approved
//     ↓
// Vendor Accepted
//
// =========================================================

export const acceptReplacementRequestController =
  asyncHandler(async (req, res) => {

    const vendorId =
      getVendorId(req);


    const {
      id,
    } = req.params;


    const {
      vendorRemarks = "",
    } = req.body;


    const request =
      await acceptReplacementRequest(

        id,

        vendorId,

        vendorRemarks
      );


    return res.status(200).json({

      success: true,

      message:
        "Replacement request accepted successfully.",

      data:
        request,
    });
  });


// =========================================================
// LINK REPLACEMENT DISPATCH
// =========================================================
//
// PATCH
// /api/vendor/replacement-requests/:id/dispatch
//
// Connects:
//
// Replacement Request
//        ↓
// Replacement Dispatch
//
// =========================================================

export const linkReplacementDispatchController =
  asyncHandler(async (req, res) => {

    const vendorId =
      getVendorId(req);


    const {
      id,
    } = req.params;


    const {
      replacementDispatchId,
    } = req.body;


    if (!replacementDispatchId) {

      return res.status(400).json({

        success: false,

        message:
          "Replacement Dispatch ID is required.",
      });
    }


    const request =
      await linkReplacementDispatch(

        id,

        replacementDispatchId,

        vendorId
      );


    return res.status(200).json({

      success: true,

      message:
        "Replacement dispatch linked successfully.",

      data:
        request,
    });
  });

// =========================================================
// CREATE RE-REPLACEMENT REQUEST
// =========================================================
//
// Used when replacement material fails Quality Inspection.
//
// Previous Request
//        ↓
// Replacement Required
//        ↓
// New Re-Replacement Request
// =========================================================

export const createReReplacementRequestController =
  async (req, res) => {

    try {

      const {
        id,
      } = req.params;

      const {
        items,
        reason = "",
        remarks = "",
        requiredReplacementDate = null,
      } = req.body;


      const replacementRequest =
        await createReReplacementRequest({

          previousReplacementRequestId:
            id,

          items,

          reason,

          remarks,

          requiredReplacementDate,

          requestedBy:
            req.user._id,

        });


      return res.status(201).json({

        success: true,

        message:
          "Re-replacement request created successfully.",

        data:
          replacementRequest,

      });

    } catch (error) {

      console.error(
        "Create Re-Replacement Request Error:",
        error
      );

      return res.status(400).json({

        success: false,

        message:
          error.message ||
          "Failed to create re-replacement request.",

      });

    }

  };