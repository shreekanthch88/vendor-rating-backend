import {
  createGoodsReceipt,
  saveDraftGoodsReceipt,
  updateGoodsReceipt,
  submitGoodsReceipt,
  getAllGoodsReceipts,
  getGoodsReceiptById,
  getEligibleDispatches,
  getPOReceiptHistory,
} from "../services/goodsReceiptService.js";

/**
 * =========================================================
 * CREATE GOODS RECEIPT
 * =========================================================
 */
export const createGoodsReceiptController = async (
  req,
  res
) => {
  try {
    const goodsReceipt =
      await createGoodsReceipt(
        req.body,
        req.user._id
      );

    return res.status(201).json({
      success: true,
      message: "Goods Receipt created successfully.",
      data: goodsReceipt,
    });
  } catch (error) {
    console.error(
      "Create Goods Receipt Error:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to create Goods Receipt.",
    });
  }
};


/**
 * =========================================================
 * SAVE DRAFT GOODS RECEIPT
 * =========================================================
 */
export const saveDraftGoodsReceiptController =
  async (req, res) => {
    try {
      const goodsReceipt =
        await saveDraftGoodsReceipt(
          req.body,
          req.user._id
        );

      return res.status(201).json({
        success: true,
        message:
          "Goods Receipt draft saved successfully.",
        data: goodsReceipt,
      });
    } catch (error) {
      console.error(
        "Save GRN Draft Error:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "Failed to save Goods Receipt draft.",
      });
    }
  };


/**
 * =========================================================
 * UPDATE DRAFT GOODS RECEIPT
 * =========================================================
 */
export const updateGoodsReceiptController =
  async (req, res) => {
    try {
      const goodsReceipt =
        await updateGoodsReceipt(
          req.params.id,
          req.body,
          req.user._id
        );

      return res.status(200).json({
        success: true,
        message:
          "Goods Receipt draft updated successfully.",
        data: goodsReceipt,
      });
    } catch (error) {
      console.error(
        "Update GRN Error:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "Failed to update Goods Receipt.",
      });
    }
  };


/**
 * =========================================================
 * SUBMIT DRAFT GOODS RECEIPT
 * =========================================================
 */
export const submitGoodsReceiptController =
  async (req, res) => {
    try {
      const goodsReceipt =
        await submitGoodsReceipt(
          req.params.id,
          req.user._id
        );

      return res.status(200).json({
        success: true,
        message:
          "Goods Receipt submitted successfully.",
        data: goodsReceipt,
      });
    } catch (error) {
      console.error(
        "Submit GRN Error:",
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          "Failed to submit Goods Receipt.",
      });
    }
  };


/**
 * =========================================================
 * GET ALL GOODS RECEIPTS
 * =========================================================
 */
export const getAllGoodsReceiptsController =
  async (req, res) => {
    try {
      const result =
        await getAllGoodsReceipts({
          page: req.query.page,
          limit: req.query.limit,
          search: req.query.search,
          status: req.query.status,
          receiptType:
            req.query.receiptType,
        });

      return res.status(200).json({
        success: true,
        message:
          "Goods Receipts fetched successfully.",
        ...result,
      });
    } catch (error) {
      console.error(
        "Get Goods Receipts Error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to fetch Goods Receipts.",
      });
    }
  };


/**
 * =========================================================
 * GET GOODS RECEIPT BY ID
 * =========================================================
 */
export const getGoodsReceiptByIdController =
  async (req, res) => {
    try {
      const goodsReceipt =
        await getGoodsReceiptById(
          req.params.id
        );

      return res.status(200).json({
        success: true,
        message:
          "Goods Receipt fetched successfully.",
        data: goodsReceipt,
      });
    } catch (error) {
      console.error(
        "Get GRN By ID Error:",
        error
      );

      return res.status(404).json({
        success: false,
        message:
          error.message ||
          "Goods Receipt not found.",
      });
    }
  };


/**
 * =========================================================
 * GET ELIGIBLE DELIVERED DISPATCHES
 * =========================================================
 */
export const getEligibleDispatchesController =
  async (req, res) => {
    try {
      const dispatches =
        await getEligibleDispatches();

      return res.status(200).json({
        success: true,
        message:
          "Eligible dispatches fetched successfully.",
        data: dispatches,
      });
    } catch (error) {
      console.error(
        "Get Eligible Dispatches Error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to fetch eligible dispatches.",
      });
    }
  };


/**
 * =========================================================
 * GET PO RECEIPT HISTORY
 * =========================================================
 */
export const getPOReceiptHistoryController =
  async (req, res) => {
    try {
      const receipts =
        await getPOReceiptHistory(
          req.params.purchaseOrderId
        );

      return res.status(200).json({
        success: true,
        message:
          "Purchase Order receipt history fetched successfully.",
        data: receipts,
      });
    } catch (error) {
      console.error(
        "Get PO Receipt History Error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to fetch receipt history.",
      });
    }
  };