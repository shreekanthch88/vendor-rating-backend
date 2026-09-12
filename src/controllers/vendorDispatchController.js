import asyncHandler from "express-async-handler";

import {
  getDispatchablePurchaseOrder,
  getVendorDispatchOverview,
  createVendorDispatch,
  getVendorDispatches,
  getVendorDispatchById,
  cancelVendorDispatch,
  updateVendorDispatchStatus,
  getPurchaseOrderDispatchHistory,
} from "../services/vendorDispatchService.js";

/**
 * ==========================================================
 * HELPER
 * ==========================================================
 *
 * Make sure the authenticated user has a vendor account.
 *
 * req.user.vendor can be:
 *
 * - ObjectId
 * - populated Vendor document
 *
 * We only need the ID.
 * ==========================================================
 */

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


/**
 * ==========================================================
 * GET DISPATCHABLE PURCHASE ORDER
 * ==========================================================
 *
 * GET
 * /api/vendor/dispatches/purchase-orders/:purchaseOrderId
 *
 * Used when the vendor opens:
 *
 * Create Dispatch
 *
 * Returns:
 *
 * - PO details
 * - PO items
 * - Ordered quantity
 * - Previously dispatched quantity
 * - Remaining quantity
 * ==========================================================
 */

export const getDispatchablePurchaseOrderController =
  asyncHandler(async (req, res) => {

    const vendorId =
      getVendorId(req);

    const {
      purchaseOrderId,
    } = req.params;

    const result =
      await getDispatchablePurchaseOrder(
        purchaseOrderId,
        vendorId
      );

    res.status(200).json({
      success: true,

      data: result,
    });
  });


  /**
 * ==========================================================
 * GET VENDOR DISPATCH OVERVIEW
 * ==========================================================
 *
 * GET
 * /api/vendor/dispatches/overview
 *
 * Used by:
 *
 * Vendor Dispatch Dashboard
 *
 * Returns Accepted Purchase Orders that are
 * ready for dispatch along with:
 *
 * - Ordered Quantity
 * - Dispatched Quantity
 * - Pending Quantity
 * - Dispatch Status
 * - Can Dispatch
 * ==========================================================
 */

export const getVendorDispatchOverviewController =
  asyncHandler(async (req, res) => {

    const vendorId =
      getVendorId(req);

    const result =
      await getVendorDispatchOverview(
        vendorId
      );

    res.status(200).json({
      success: true,

      ...result,
    });
  });

/**
 * ==========================================================
 * CREATE VENDOR DISPATCH
 * ==========================================================
 *
 * POST
 * /api/vendor/dispatches
 *
 * Body contains:
 *
 * {
 *   purchaseOrder,
 *   dispatchDate,
 *   expectedDeliveryDate,
 *   items,
 *   transporterName,
 *   vehicleNumber,
 *   ...
 * }
 *
 * The service performs all business validation.
 * ==========================================================
 */

export const createVendorDispatchController =
  asyncHandler(async (req, res) => {

    const vendorId =
      getVendorId(req);

    const userId =
      req.user._id;

    const dispatch =
      await createVendorDispatch(
        req.body,
        vendorId,
        userId
      );

    res.status(201).json({
      success: true,

      message:
        "Dispatch created successfully.",

      data: dispatch,
    });
  });


/**
 * ==========================================================
 * GET ALL VENDOR DISPATCHES
 * ==========================================================
 *
 * GET
 * /api/vendor/dispatches
 *
 * Query:
 *
 * ?page=1
 * &limit=10
 * &search=
 * &status=
 * ==========================================================
 */

export const getVendorDispatchesController =
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
      await getVendorDispatches({
        vendorId,

        page,

        limit,

        search,

        status,
      });

    res.status(200).json({
      success: true,

      ...result,
    });
  });


/**
 * ==========================================================
 * GET VENDOR DISPATCH BY ID
 * ==========================================================
 *
 * GET
 * /api/vendor/dispatches/:id
 *
 * Vendor can only see their own dispatch.
 * ==========================================================
 */

export const getVendorDispatchByIdController =
  asyncHandler(async (req, res) => {

    const vendorId =
      getVendorId(req);

    const {
      id,
    } = req.params;

    const dispatch =
      await getVendorDispatchById(
        id,
        vendorId
      );

    res.status(200).json({
      success: true,

      data: dispatch,
    });
  });


/**
 * ==========================================================
 * CANCEL VENDOR DISPATCH
 * ==========================================================
 *
 * PATCH
 * /api/vendor/dispatches/:id/cancel
 *
 * Only Draft dispatches can be cancelled.
 * ==========================================================
 */

export const cancelVendorDispatchController =
  asyncHandler(async (req, res) => {

    const vendorId =
      getVendorId(req);

    const userId =
      req.user._id;

    const {
      id,
    } = req.params;

    const dispatch =
      await cancelVendorDispatch(
        id,
        vendorId,
        userId
      );

    res.status(200).json({
      success: true,

      message:
        "Dispatch cancelled successfully.",

      data: dispatch,
    });
  });

/**
 * ==========================================================
 * UPDATE DISPATCH STATUS
 * ==========================================================
 *
 * PATCH
 * /api/vendor/dispatches/:id/status
 * ==========================================================
 */

export const updateVendorDispatchStatusController =
  asyncHandler(async (req, res) => {

    const vendorId =
      getVendorId(req);

    const userId =
      req.user._id;

    const { id } =
      req.params;

    const dispatch =
      await updateVendorDispatchStatus(
        id,
        vendorId,
        userId,
        req.body
      );

    res.status(200).json({
      success: true,

      message:
        "Dispatch status updated successfully.",

      data: dispatch,
    });
  });

  /**
 * ==========================================================
 * GET PURCHASE ORDER DISPATCH HISTORY
 * ==========================================================
 *
 * GET
 * /api/vendor/dispatches/purchase-orders/:purchaseOrderId/history
 *
 * Returns every dispatch belonging to the PO.
 *
 * ==========================================================
 */

export const getPurchaseOrderDispatchHistoryController =
  asyncHandler(async (req, res) => {

    const vendorId =
      getVendorId(req);

    const {
      purchaseOrderId,
    } = req.params;

    const result =
      await getPurchaseOrderDispatchHistory(
        purchaseOrderId,
        vendorId
      );

    res.status(200).json({

      success: true,

      message:
        "Purchase Order dispatch history fetched successfully.",

      data:
        result,

    });
  });