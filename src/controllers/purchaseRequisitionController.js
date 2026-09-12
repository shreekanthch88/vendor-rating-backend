import asyncHandler from "express-async-handler";

import {
  createPurchaseRequisition,
  getAllPurchaseRequisitions,
  getPurchaseRequisitionById,
  updatePurchaseRequisition,
  submitPurchaseRequisition,
  approvePurchaseRequisition,
  rejectPurchaseRequisition,
  deletePurchaseRequisition,
  getPurchaseRequisitionDashboard,
} from "../services/purchaseRequisitionService.js";

/**
 * Create Purchase Requisition
 * POST /api/purchase-requisitions
 */
export const createPurchaseRequisitionController =
  asyncHandler(async (req, res) => {
    const requisition = await createPurchaseRequisition(
      req.body,
      req.user._id
    );

    res.status(201).json({
      success: true,
      message: "Purchase Requisition created successfully.",
      data: requisition,
    });
  });

/**
 * Get All Purchase Requisitions
 * GET /api/purchase-requisitions
 */
export const getPurchaseRequisitionsController =
  asyncHandler(async (req, res) => {
    const result = await getAllPurchaseRequisitions(req.query);

    res.status(200).json({
      success: true,
      ...result,
    });
  });

/**
 * Get Purchase Requisition By ID
 * GET /api/purchase-requisitions/:id
 */
export const getPurchaseRequisitionByIdController =
  asyncHandler(async (req, res) => {
    const requisition = await getPurchaseRequisitionById(
      req.params.id
    );

    res.status(200).json({
      success: true,
      data: requisition,
    });
  });

/**
 * Update Purchase Requisition
 * PUT /api/purchase-requisitions/:id
 */
export const updatePurchaseRequisitionController =
  asyncHandler(async (req, res) => {
    const requisition = await updatePurchaseRequisition(
      req.params.id,
      req.body,
      req.user._id
    );

    res.status(200).json({
      success: true,
      message: "Purchase Requisition updated successfully.",
      data: requisition,
    });
  });

/**
 * Submit Purchase Requisition
 * PATCH /api/purchase-requisitions/:id/submit
 */
export const submitPurchaseRequisitionController =
  asyncHandler(async (req, res) => {
    const requisition = await submitPurchaseRequisition(
      req.params.id,
      req.user._id
    );

    res.status(200).json({
      success: true,
      message: "Purchase Requisition submitted successfully.",
      data: requisition,
    });
  });

/**
 * Approve Purchase Requisition
 * PATCH /api/purchase-requisitions/:id/approve
 */
export const approvePurchaseRequisitionController =
  asyncHandler(async (req, res) => {
    const requisition = await approvePurchaseRequisition(
      req.params.id,
      req.user._id
    );

    res.status(200).json({
      success: true,
      message: "Purchase Requisition approved successfully.",
      data: requisition,
    });
  });

/**
 * Reject Purchase Requisition
 * PATCH /api/purchase-requisitions/:id/reject
 */
export const rejectPurchaseRequisitionController =
  asyncHandler(async (req, res) => {
    const requisition = await rejectPurchaseRequisition(
      req.params.id,
      req.body.reason,
      req.user._id
    );

    res.status(200).json({
      success: true,
      message: "Purchase Requisition rejected successfully.",
      data: requisition,
    });
  });

/**
 * Delete Purchase Requisition
 * DELETE /api/purchase-requisitions/:id
 */
export const deletePurchaseRequisitionController =
  asyncHandler(async (req, res) => {
    await deletePurchaseRequisition(
      req.params.id,
      req.user._id
    );

    res.status(200).json({
      success: true,
      message: "Purchase Requisition deleted successfully.",
    });
  });

/**
 * Purchase Requisition Dashboard
 * GET /api/purchase-requisitions/dashboard
 */
export const getPurchaseRequisitionDashboardController =
  asyncHandler(async (req, res) => {
    const dashboard =
      await getPurchaseRequisitionDashboard();

    res.status(200).json({
      success: true,
      data: dashboard,
    });
  });