import asyncHandler from "express-async-handler";

import {
  createPurchaseOrder,
  getAllPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrder,
  deletePurchaseOrder,
  submitPurchaseOrder,
  approvePurchaseOrder,
  rejectPurchaseOrder,
  sendPurchaseOrderToVendor,
  vendorAcceptPurchaseOrder,
  vendorRejectPurchaseOrder,
  getPurchaseOrderDashboard,
  getPurchaseOrderCharts,
  getPurchaseOrderFulfillment,
} from "../services/purchaseOrderService.js";

/**
 * ===========================================
 * Create Purchase Order
 * POST /api/purchase-orders
 * ===========================================
 */
export const createPurchaseOrderController =
  asyncHandler(async (req, res) => {

    const purchaseOrder =
      await createPurchaseOrder(
        req.body,
        req.user._id
      );

    res.status(201).json({
      success: true,
      message:
        "Purchase Order created successfully.",
      data: purchaseOrder,
    });

  });

/**
 * ===========================================
 * Get All Purchase Orders
 * GET /api/purchase-orders
 * ===========================================
 */
export const getPurchaseOrdersController =
  asyncHandler(async (req, res) => {

    const result =
      await getAllPurchaseOrders(req.query);

    res.status(200).json({
      success: true,
      ...result,
    });

  });

/**
 * ===========================================
 * Get Purchase Order By ID
 * GET /api/purchase-orders/:id
 * ===========================================
 */
export const getPurchaseOrderByIdController =
  asyncHandler(async (req, res) => {

    const purchaseOrder =
      await getPurchaseOrderById(
        req.params.id
      );

    res.status(200).json({
      success: true,
      data: purchaseOrder,
    });

  });
  /**
 * ===========================================
 * Update Purchase Order
 * PUT /api/purchase-orders/:id
 * ===========================================
 */
export const updatePurchaseOrderController =
  asyncHandler(async (req, res) => {

    const purchaseOrder =
      await updatePurchaseOrder(
        req.params.id,
        req.body,
        req.user._id
      );

    res.status(200).json({
      success: true,
      message:
        "Purchase Order updated successfully.",
      data: purchaseOrder,
    });

  });

/**
 * ===========================================
 * Delete Purchase Order
 * DELETE /api/purchase-orders/:id
 * ===========================================
 */
export const deletePurchaseOrderController =
  asyncHandler(async (req, res) => {

    await deletePurchaseOrder(
      req.params.id,
      req.user._id
    );

    res.status(200).json({
      success: true,
      message:
        "Purchase Order deleted successfully.",
    });

  });

/**
 * ===========================================
 * Submit Purchase Order
 * PATCH /api/purchase-orders/:id/submit
 * ===========================================
 */
export const submitPurchaseOrderController =
  asyncHandler(async (req, res) => {

    const purchaseOrder =
      await submitPurchaseOrder(
        req.params.id,
        req.user._id
      );

    res.status(200).json({
      success: true,
      message:
        "Purchase Order submitted successfully.",
      data: purchaseOrder,
    });

  });

/**
 * ===========================================
 * Approve Purchase Order
 * PATCH /api/purchase-orders/:id/approve
 * ===========================================
 */
export const approvePurchaseOrderController =
  asyncHandler(async (req, res) => {

    const purchaseOrder =
      await approvePurchaseOrder(
        req.params.id,
        req.user._id
      );

    res.status(200).json({
      success: true,
      message:
        "Purchase Order approved successfully.",
      data: purchaseOrder,
    });

  });

  /**
 * ===========================================
 * Reject Purchase Order
 * PATCH /api/purchase-orders/:id/reject
 * ===========================================
 */
export const rejectPurchaseOrderController =
  asyncHandler(async (req, res) => {

    const purchaseOrder =
      await rejectPurchaseOrder(
        req.params.id,
        req.body.reason,
        req.user._id
      );

    res.status(200).json({
      success: true,
      message:
        "Purchase Order rejected successfully.",
      data: purchaseOrder,
    });

  });

/**
 * ===========================================
 * Send Purchase Order To Vendor
 * PATCH /api/purchase-orders/:id/send
 * ===========================================
 */
export const sendPurchaseOrderToVendorController =
  asyncHandler(async (req, res) => {

    const purchaseOrder =
      await sendPurchaseOrderToVendor(
        req.params.id,
        req.user._id
      );

    res.status(200).json({
      success: true,
      message:
        "Purchase Order sent to vendor successfully.",
      data: purchaseOrder,
    });

  });

/**
 * ===========================================
 * Vendor Accept Purchase Order
 * PATCH /api/purchase-orders/:id/vendor-accept
 * ===========================================
 */
export const vendorAcceptPurchaseOrderController =
  asyncHandler(async (req, res) => {

    const purchaseOrder =
      await vendorAcceptPurchaseOrder(
        req.params.id,
        req.body.remarks
      );

    res.status(200).json({
      success: true,
      message:
        "Purchase Order accepted by vendor.",
      data: purchaseOrder,
    });

  });

/**
 * ===========================================
 * Vendor Reject Purchase Order
 * PATCH /api/purchase-orders/:id/vendor-reject
 * ===========================================
 */
export const vendorRejectPurchaseOrderController =
  asyncHandler(async (req, res) => {

    const purchaseOrder =
      await vendorRejectPurchaseOrder(
        req.params.id,
        req.body.remarks
      );

    res.status(200).json({
      success: true,
      message:
        "Purchase Order rejected by vendor.",
      data: purchaseOrder,
    });

  });

/**
 * ===========================================
 * Purchase Order Dashboard
 * GET /api/purchase-orders/dashboard
 * ===========================================
 */
export const getPurchaseOrderDashboardController =
  asyncHandler(async (req, res) => {

    const dashboard =
      await getPurchaseOrderDashboard();

    res.status(200).json({
      success: true,
      data: dashboard,
    });

  });

  export const getPurchaseOrderChartsController =
  asyncHandler(async (req, res) => {

    const charts =
      await getPurchaseOrderCharts();

    res.status(200).json({
      success: true,
      data: charts,
    });

  });


  // =========================================================
// GET PURCHASE ORDER FULFILLMENT
// =========================================================
//
// GET
// /api/purchase-orders/:id/fulfillment
//
// Returns:
// - Ordered quantity
// - Original dispatched quantity
// - Original received quantity
// - Original accepted quantity
// - Replacement quantities
// - Final fulfilled quantity
// - Final pending quantity
// - Fulfillment percentage
//
// =========================================================

export const getPurchaseOrderFulfillmentController =
  async (req, res) => {

    try {

      const {
        id,
      } = req.params;


      const result =
        await getPurchaseOrderFulfillment(
          id
        );


      return res.status(200).json({

        success: true,

        message:
          "Purchase Order fulfillment fetched successfully.",

        data:
          result,

      });

    } catch (error) {

      console.error(
        "Get Purchase Order Fulfillment Error:",
        error
      );


      return res.status(400).json({

        success: false,

        message:
          error.message ||
          "Failed to fetch Purchase Order fulfillment.",

      });

    }

  };

  