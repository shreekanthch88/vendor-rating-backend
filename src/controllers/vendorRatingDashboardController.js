import {
  getVendorRatingDashboardAnalytics,
} from "../services/vendorRatingDashboardService.js";

/**
 * =========================================================
 * ADMIN VENDOR RATING DASHBOARD CONTROLLER
 * =========================================================
 *
 * GET
 * /api/vendor-rating-dashboard
 *
 * Query parameters:
 *
 * ?fromDate=2026-08-01
 * &toDate=2026-08-31
 *
 * The controller is intentionally thin.
 *
 * Business/data aggregation stays inside:
 *
 * vendorRatingDashboardService.js
 *
 * =========================================================
 */

export const getVendorRatingDashboard = async (
  req,
  res
) => {

  try {

    const {
      fromDate,
      toDate,
    } = req.query;


    /**
     * -------------------------------------------------------
     * Validate date range
     * -------------------------------------------------------
     */

    if (
      fromDate &&
      toDate &&
      new Date(fromDate) >
        new Date(toDate)
    ) {

      return res.status(400).json({
        success: false,
        message:
          "From date cannot be after to date.",
      });
    }


    /**
     * -------------------------------------------------------
     * Get dashboard analytics
     * -------------------------------------------------------
     */

    const dashboard =
      await getVendorRatingDashboardAnalytics({
        fromDate,
        toDate,
      });


    /**
     * -------------------------------------------------------
     * Success response
     * -------------------------------------------------------
     */

    return res.status(200).json({

      success: true,

      message:
        "Vendor rating dashboard data fetched successfully.",

      data:
        dashboard,
    });

  } catch (error) {

    console.error(
      "Vendor Rating Dashboard Error:",
      error
    );


    /**
     * -------------------------------------------------------
     * Error response
     * -------------------------------------------------------
     */

    return res.status(500).json({

      success: false,

      message:
        "Failed to fetch vendor rating dashboard data.",

      error:
        process.env.NODE_ENV ===
        "development"
          ? error.message
          : undefined,
    });
  }
};