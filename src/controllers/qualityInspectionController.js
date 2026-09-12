import {
  getEligibleGoodsReceipts,
  getGoodsReceiptForInspection,
  createQualityInspection,
  getAllQualityInspections,
  getReplacementEligibleQualityInspections,
  getQualityInspectionById,
  updateQualityInspection,
  completeQualityInspection,
  getPOQualityInspectionHistory,
  getVendorQualityInspectionHistory,
  getQualityInspectionDashboardSummary,
  getQualityInspectionAnalytics,
} from "../services/qualityInspectionService.js";


/**
 * =========================================================
 * GET QUALITY INSPECTION ANALYTICS
 * =========================================================
 */
export const getQualityInspectionAnalyticsController = async (req, res) => {
  try {
    const { timePeriod, vendorId, categoryId } = req.query;

    const analytics = await getQualityInspectionAnalytics({
      timePeriod,
      vendorId,
      categoryId,
    });

    return res.status(200).json({
      success: true,
      message: "Quality Inspection analytics fetched successfully.",
      data: analytics,
    });
  } catch (error) {
    console.error("Get Quality Inspection Analytics Error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch Quality Inspection analytics.",
    });
  }
};


/**
 * =========================================================
 * GET QUALITY INSPECTION DASHBOARD SUMMARY
 * =========================================================
 */

export const getQualityInspectionDashboardSummaryController =
  async (req, res) => {

    try {

      const summary =
        await getQualityInspectionDashboardSummary();


      return res.status(200).json({

        success: true,

        message:
          "Quality Inspection dashboard summary fetched successfully.",

        data:
          summary,

      });

    } catch (error) {

      console.error(
        "Get Quality Inspection Dashboard Summary Error:",
        error
      );


      return res.status(500).json({

        success: false,

        message:
          error.message ||
          "Failed to fetch Quality Inspection dashboard summary.",

      });

    }

  };

/**
 * =========================================================
 * GET ELIGIBLE GOODS RECEIPTS
 * =========================================================
 *
 * Used by:
 *
 * Admin
 *   ↓
 * Quality Inspection
 *   ↓
 * Create Inspection
 *   ↓
 * Select GRN
 */
export const getEligibleGoodsReceiptsController =
  async (req, res) => {

    try {

      const receipts =
        await getEligibleGoodsReceipts();

      return res.status(200).json({

        success: true,

        message:
          "Eligible Goods Receipts fetched successfully.",

        data:
          receipts,

      });

    } catch (error) {

      console.error(
        "Get Eligible Goods Receipts Error:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          error.message ||
          "Failed to fetch eligible Goods Receipts.",

      });

    }

  };


/**
 * =========================================================
 * GET GOODS RECEIPT FOR INSPECTION
 * =========================================================
 */
export const getGoodsReceiptForInspectionController =
  async (req, res) => {

    try {

      const goodsReceipt =
        await getGoodsReceiptForInspection(
          req.params.goodsReceiptId
        );

      return res.status(200).json({

        success: true,

        message:
          "Goods Receipt fetched for Quality Inspection.",

        data:
          goodsReceipt,

      });

    } catch (error) {

      console.error(
        "Get GRN For Inspection Error:",
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
 * CREATE QUALITY INSPECTION
 * =========================================================
 *
 * Creates a Draft Quality Inspection from a GRN.
 */
export const createQualityInspectionController =
  async (req, res) => {

    try {

      const {
        goodsReceiptId,
      } = req.body;


      if (!goodsReceiptId) {

        return res.status(400).json({

          success: false,

          message:
            "Goods Receipt ID is required.",

        });

      }


      const inspection =
        await createQualityInspection(
          goodsReceiptId,
          req.user._id
        );


      return res.status(201).json({

        success: true,

        message:
          "Quality Inspection created successfully.",

        data:
          inspection,

      });

    } catch (error) {

      console.error(
        "Create Quality Inspection Error:",
        error
      );

      return res.status(400).json({

        success: false,

        message:
          error.message ||
          "Failed to create Quality Inspection.",

      });

    }

  };


/**
 * =========================================================
 * GET ALL QUALITY INSPECTIONS
 * =========================================================
 *
 * Supports:
 *
 * ?page=1
 * ?limit=10
 * ?search=QI-000001
 * ?status=Completed
 * ?result=Rejected
 * ?vendor=vendorId
 */
export const getAllQualityInspectionsController =
  async (req, res) => {

    try {

      const result =
        await getAllQualityInspections({

          page:
            req.query.page,

          limit:
            req.query.limit,

          search:
            req.query.search,

          status:
            req.query.status,

          result:
            req.query.result,

          vendor:
            req.query.vendor,

        });


      return res.status(200).json({

        success: true,

        message:
          "Quality Inspections fetched successfully.",

        ...result,

      });

    } catch (error) {

      console.error(
        "Get Quality Inspections Error:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          error.message ||
          "Failed to fetch Quality Inspections.",

      });

    }

  };

/**
 * =========================================================
 * GET QUALITY INSPECTIONS ELIGIBLE FOR REPLACEMENT
 * =========================================================
 *
 * Used by:
 *
 * Quality Inspection
 *        ↓
 * Replacement
 *        ↓
 * Create Replacement Request
 *
 * Returns only completed inspections where:
 *
 * replacementRequired = true
 *
 * API:
 *
 * GET
 * /api/quality-inspections/replacement-eligible
 */
export const getReplacementEligibleQualityInspectionsController =
  async (req, res) => {

    try {

      const inspections =
        await getReplacementEligibleQualityInspections();


      return res.status(200).json({

        success: true,

        message:
          "Quality Inspections eligible for replacement fetched successfully.",

        data:
          inspections,

      });

    } catch (error) {

      console.error(
        "Get Replacement Eligible Quality Inspections Error:",
        error
      );


      return res.status(500).json({

        success: false,

        message:
          error.message ||
          "Failed to fetch Quality Inspections eligible for replacement.",

      });

    }

  };
/**
 * =========================================================
 * GET QUALITY INSPECTION BY ID
 * =========================================================
 */
export const getQualityInspectionByIdController =
  async (req, res) => {

    try {

      const inspection =
        await getQualityInspectionById(
          req.params.id
        );


      return res.status(200).json({

        success: true,

        message:
          "Quality Inspection fetched successfully.",

        data:
          inspection,

      });

    } catch (error) {

      console.error(
        "Get Quality Inspection By ID Error:",
        error
      );

      return res.status(404).json({

        success: false,

        message:
          error.message ||
          "Quality Inspection not found.",

      });

    }

  };


/**
 * =========================================================
 * UPDATE QUALITY INSPECTION
 * =========================================================
 *
 * Only Draft inspections can be updated.
 */
export const updateQualityInspectionController =
  async (req, res) => {

    try {

      const inspection =
        await updateQualityInspection(

          req.params.id,

          req.body,

          req.user._id

        );


      return res.status(200).json({

        success: true,

        message:
          "Quality Inspection updated successfully.",

        data:
          inspection,

      });

    } catch (error) {

      console.error(
        "Update Quality Inspection Error:",
        error
      );

      return res.status(400).json({

        success: false,

        message:
          error.message ||
          "Failed to update Quality Inspection.",

      });

    }

  };


/**
 * =========================================================
 * COMPLETE QUALITY INSPECTION
 * =========================================================
 *
 * Draft
 *   ↓
 * Complete
 */
export const completeQualityInspectionController =
  async (req, res) => {

    try {

      const inspection =
        await completeQualityInspection(

          req.params.id,

          req.user._id

        );


      return res.status(200).json({

        success: true,

        message:
          "Quality Inspection completed successfully.",

        data:
          inspection,

      });

    } catch (error) {

      console.error(
        "Complete Quality Inspection Error:",
        error
      );

      return res.status(400).json({

        success: false,

        message:
          error.message ||
          "Failed to complete Quality Inspection.",

      });

    }

  };


/**
 * =========================================================
 * GET PO QUALITY INSPECTION HISTORY
 * =========================================================
 */
export const getPOQualityInspectionHistoryController =
  async (req, res) => {

    try {

      const inspections =
        await getPOQualityInspectionHistory(

          req.params.purchaseOrderId

        );


      return res.status(200).json({

        success: true,

        message:
          "Purchase Order Quality Inspection history fetched successfully.",

        data:
          inspections,

      });

    } catch (error) {

      console.error(
        "Get PO Quality Inspection History Error:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          error.message ||
          "Failed to fetch Quality Inspection history.",

      });

    }

  };


/**
 * =========================================================
 * GET VENDOR QUALITY INSPECTION HISTORY
 * =========================================================
 */
export const getVendorQualityInspectionHistoryController =
  async (req, res) => {

    try {

      const inspections =
        await getVendorQualityInspectionHistory(

          req.params.vendorId

        );


      return res.status(200).json({

        success: true,

        message:
          "Vendor Quality Inspection history fetched successfully.",

        data:
          inspections,

      });

    } catch (error) {

      console.error(
        "Get Vendor Quality Inspection History Error:",
        error
      );

      return res.status(500).json({

        success: false,

        message:
          error.message ||
          "Failed to fetch Vendor Quality Inspection history.",

      });

    }

  };