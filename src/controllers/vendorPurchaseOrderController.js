import asyncHandler from "express-async-handler";

import {
  getVendorPurchaseOrders,
  getVendorPurchaseOrderById,
  acceptVendorPurchaseOrder,
  rejectVendorPurchaseOrder,
} from "../services/vendorPurchaseOrderService.js";

/**
 * ===========================================
 * Get Vendor Purchase Orders
 * GET /api/vendor/purchase-orders
 * ===========================================
 */
export const getVendorPurchaseOrdersController =
  asyncHandler(async (req, res) => {
    // Make sure the logged-in user is connected
    // to a vendor.
    if (!req.user.vendor) {
      res.status(403);
      throw new Error(
        "Vendor account is not associated with a vendor."
      );
    }

    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
    } = req.query;

    const result =
      await getVendorPurchaseOrders(
        req.user.vendor,
        {
          page,
          limit,
          search,
          status,
        }
      );

    res.status(200).json({
      success: true,
      ...result,
    });
  });

/**
 * ===========================================
 * Get Vendor Purchase Order By ID
 * GET /api/vendor/purchase-orders/:id
 * ===========================================
 */
export const getVendorPurchaseOrderByIdController =
  asyncHandler(async (req, res) => {
    if (!req.user.vendor) {
      res.status(403);
      throw new Error(
        "Vendor account is not associated with a vendor."
      );
    }

    const purchaseOrder =
      await getVendorPurchaseOrderById(
        req.user.vendor,
        req.params.id
      );

    res.status(200).json({
      success: true,
      data: purchaseOrder,
    });
  });

/**
 * ===========================================
 * Accept Vendor Purchase Order
 * PATCH /api/vendor/purchase-orders/:id/accept
 * ===========================================
 */
export const acceptVendorPurchaseOrderController =
  asyncHandler(async (req, res) => {
    if (!req.user.vendor) {
      res.status(403);
      throw new Error(
        "Vendor account is not associated with a vendor."
      );
    }

    const purchaseOrder =
      await acceptVendorPurchaseOrder(
        req.user.vendor,
        req.params.id,
        req.body.remarks || ""
      );

    res.status(200).json({
      success: true,
      message:
        "Purchase Order accepted successfully.",
      data: purchaseOrder,
    });
  });

/**
 * ===========================================
 * Reject Vendor Purchase Order
 * PATCH /api/vendor/purchase-orders/:id/reject
 * ===========================================
 */
export const rejectVendorPurchaseOrderController =
  asyncHandler(async (req, res) => {
    if (!req.user.vendor) {
      res.status(403);
      throw new Error(
        "Vendor account is not associated with a vendor."
      );
    }

    const purchaseOrder =
      await rejectVendorPurchaseOrder(
        req.user.vendor,
        req.params.id,
        req.body.remarks || ""
      );

    res.status(200).json({
      success: true,
      message:
        "Purchase Order rejected successfully.",
      data: purchaseOrder,
    });
  });