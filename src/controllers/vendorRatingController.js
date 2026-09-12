import vendorRatingService from "../services/vendorRatingService.js";

/**
 * =========================================================
 * GENERATE VENDOR RATING
 * =========================================================
 *
 * POST /api/vendor-ratings/generate
 *
 * Admin / authorized internal users only.
 *
 * Body:
 * {
 *   "vendorId": "...",
 *   "fromDate": "2026-01-01",
 *   "toDate": "2026-06-30"
 * }
 *
 * =========================================================
 */

export const generateVendorRating = async (
  req,
  res
) => {
  try {
    const {
      vendorId,
      fromDate,
      toDate,
    } = req.body;

    if (
      !vendorId ||
      !fromDate ||
      !toDate
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Vendor, from date and to date are required.",
      });
    }

    const rating =
      await vendorRatingService.generateVendorRating({
        vendorId,
        fromDate,
        toDate,
        createdBy: req.user._id,
      });

    return res.status(201).json({
      success: true,
      message:
        "Vendor rating generated successfully.",
      data: rating,
    });

  } catch (error) {
    console.error(
      "Generate Vendor Rating Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to generate vendor rating.",
    });
  }
};


/**
 * =========================================================
 * GET VENDOR RATINGS
 * =========================================================
 *
 * GET /api/vendor-ratings
 *
 * Admin:
 *   Can view all vendors.
 *
 * Vendor:
 *   Can view only own vendor ratings.
 *
 * Query:
 *
 * ?vendorId=
 * ?status=
 * ?page=
 * ?limit=
 *
 * =========================================================
 */

export const getVendorRatings = async (
  req,
  res
) => {
  try {
    const {
      vendorId,
      status,
      page,
      limit,
    } = req.query;

    let effectiveVendorId =
      vendorId || undefined;


    /**
     * Vendor users MUST NOT be allowed
     * to request another vendor's ID.
     */

    if (
      req.user.role === "VENDOR"
    ) {

      if (
        !req.user.vendor
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Vendor account is not linked to a vendor.",
        });
      }

      effectiveVendorId =
        req.user.vendor;
    }


    const result =
      await vendorRatingService.getVendorRatings({
        vendorId:
          effectiveVendorId,

        page,

        limit,

        status,
      });


    return res.status(200).json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error(
      "Get Vendor Ratings Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch vendor ratings.",
    });
  }
};


/**
 * =========================================================
 * GET RATING BY ID
 * =========================================================
 *
 * GET /api/vendor-ratings/:id
 *
 * Vendor can only access own rating.
 *
 * =========================================================
 */

export const getVendorRatingById = async (
  req,
  res
) => {
  try {
    const {
      id,
    } = req.params;


    const rating =
      await vendorRatingService.getVendorRatingById(
        id
      );


    /**
     * Vendor isolation.
     */

    if (
      req.user.role === "VENDOR"
    ) {

      if (
        !req.user.vendor
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Vendor account is not linked to a vendor.",
        });
      }


      if (
        String(
          rating.vendor?._id ||
          rating.vendor
        ) !==
        String(
          req.user.vendor
        )
      ) {

        return res.status(403).json({
          success: false,
          message:
            "You are not authorized to access this vendor rating.",
        });
      }
    }


    return res.status(200).json({
      success: true,
      data: rating,
    });

  } catch (error) {
    console.error(
      "Get Vendor Rating Error:",
      error
    );


    if (
      error.message ===
      "Vendor rating not found."
    ) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }


    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch vendor rating.",
    });
  }
};


/**
 * =========================================================
 * UPDATE EVALUATOR SCORES
 * =========================================================
 *
 * PUT /api/vendor-ratings/:id/evaluate
 *
 * Authorized evaluator only.
 *
 * =========================================================
 */

export const updateEvaluatorScores =
  async (
    req,
    res
  ) => {

    try {

      const {
        id,
      } = req.params;


      const {
        evaluatorScores,
        communication,
        remarks,
      } = req.body;


      const rating =
        await vendorRatingService
          .updateEvaluatorScores({
            ratingId: id,

            evaluatorScores:
              evaluatorScores || {},

            communication:
              communication || {},

            remarks:
              remarks || "",

            evaluatedBy:
              req.user._id,
          });


      return res.status(200).json({
        success: true,

        message:
          "Vendor rating evaluation updated successfully.",

        data: rating,
      });

    } catch (error) {

      console.error(
        "Update Evaluator Score Error:",
        error
      );


      return res.status(400).json({
        success: false,

        message:
          error.message ||
          "Failed to update evaluator score.",
      });
    }
  };


/**
 * =========================================================
 * SUBMIT RATING
 * =========================================================
 *
 * POST /api/vendor-ratings/:id/submit
 *
 * =========================================================
 */

export const submitVendorRating =
  async (
    req,
    res
  ) => {

    try {

      const {
        id,
      } = req.params;


      const rating =
        await vendorRatingService
          .submitVendorRating({
            ratingId: id,

            userId:
              req.user._id,
          });


      return res.status(200).json({
        success: true,

        message:
          "Vendor rating submitted successfully.",

        data: rating,
      });

    } catch (error) {

      console.error(
        "Submit Vendor Rating Error:",
        error
      );


      return res.status(400).json({
        success: false,

        message:
          error.message ||
          "Failed to submit vendor rating.",
      });
    }
  };


/**
 * =========================================================
 * APPROVE RATING
 * =========================================================
 *
 * POST /api/vendor-ratings/:id/approve
 *
 * =========================================================
 */

export const approveVendorRating =
  async (
    req,
    res
  ) => {

    try {

      const {
        id,
      } = req.params;


      const rating =
        await vendorRatingService
          .approveVendorRating({
            ratingId: id,

            userId:
              req.user._id,
          });


      return res.status(200).json({
        success: true,

        message:
          "Vendor rating approved successfully.",

        data: rating,
      });

    } catch (error) {

      console.error(
        "Approve Vendor Rating Error:",
        error
      );


      return res.status(400).json({
        success: false,

        message:
          error.message ||
          "Failed to approve vendor rating.",
      });
    }
  };


/**
 * =========================================================
 * LOCK RATING
 * =========================================================
 *
 * POST /api/vendor-ratings/:id/lock
 *
 * =========================================================
 */

export const lockVendorRating =
  async (
    req,
    res
  ) => {

    try {

      const {
        id,
      } = req.params;


      const rating =
        await vendorRatingService
          .lockVendorRating({
            ratingId: id,

            userId:
              req.user._id,
          });


      return res.status(200).json({
        success: true,

        message:
          "Vendor rating locked successfully.",

        data: rating,
      });

    } catch (error) {

      console.error(
        "Lock Vendor Rating Error:",
        error
      );


      return res.status(400).json({
        success: false,

        message:
          error.message ||
          "Failed to lock vendor rating.",
      });
    }
  };


/**
 * =========================================================
 * DELETE RATING
 * =========================================================
 *
 * DELETE /api/vendor-ratings/:id
 *
 * Only draft / non-approved records.
 *
 * =========================================================
 */

export const deleteVendorRating =
  async (
    req,
    res
  ) => {

    try {

      const {
        id,
      } = req.params;


      const rating =
        await vendorRatingService
          .deleteVendorRating({
            ratingId: id,

            userId:
              req.user._id,
          });


      return res.status(200).json({
        success: true,

        message:
          "Vendor rating deleted successfully.",

        data: rating,
      });

    } catch (error) {

      console.error(
        "Delete Vendor Rating Error:",
        error
      );


      return res.status(400).json({
        success: false,

        message:
          error.message ||
          "Failed to delete vendor rating.",
      });
    }
  };


/**
 * =========================================================
 * GET LATEST RATING
 * =========================================================
 *
 * GET /api/vendor-ratings/vendor/:vendorId/latest
 *
 * =========================================================
 */

export const getLatestVendorRating =
  async (
    req,
    res
  ) => {

    try {

      let {
        vendorId,
      } = req.params;


      /**
       * Vendor can only request own rating.
       */

      if (
        req.user.role === "VENDOR"
      ) {

        if (
          !req.user.vendor
        ) {
          return res.status(403).json({
            success: false,
            message:
              "Vendor account is not linked to a vendor.",
          });
        }


        vendorId =
          req.user.vendor;
      }


      const rating =
        await vendorRatingService
          .getLatestVendorRating(
            vendorId
          );


      if (!rating) {

        return res.status(404).json({
          success: false,

          message:
            "No vendor rating found.",
        });
      }


      return res.status(200).json({
        success: true,

        data: rating,
      });

    } catch (error) {

      console.error(
        "Get Latest Rating Error:",
        error
      );


      return res.status(500).json({
        success: false,

        message:
          error.message ||
          "Failed to fetch latest vendor rating.",
      });
    }
  };


/**
 * =========================================================
 * VENDOR RATING DASHBOARD
 * =========================================================
 *
 * GET /api/vendor-ratings/vendor/:vendorId/dashboard
 *
 * =========================================================
 */

export const getVendorRatingDashboard =
  async (
    req,
    res
  ) => {

    try {

      let {
        vendorId,
      } = req.params;


      /**
       * Vendor isolation.
       */

      if (
        req.user.role === "VENDOR"
      ) {

        if (
          !req.user.vendor
        ) {
          return res.status(403).json({
            success: false,
            message:
              "Vendor account is not linked to a vendor.",
          });
        }


        vendorId =
          req.user.vendor;
      }


      const dashboard =
        await vendorRatingService
          .getVendorRatingDashboard(
            vendorId
          );


      return res.status(200).json({
        success: true,

        data: dashboard,
      });

    } catch (error) {

      console.error(
        "Vendor Rating Dashboard Error:",
        error
      );


      return res.status(500).json({
        success: false,

        message:
          error.message ||
          "Failed to fetch vendor rating dashboard.",
      });
    }
  };

/**
 * =========================================================
 * GET DELIVERY CALCULATION DETAILS (TRANSPARENCY)
 * =========================================================
 *
 * GET /api/vendor-ratings/:id/delivery-calculation
 */
export const getDeliveryCalculation = async (req, res) => {
  try {
    const { id } = req.params;

    const data =
      await vendorRatingService.getDeliveryCalculationDetails(id);

    // Vendor isolation
    if (req.user.role === "VENDOR") {
      if (!req.user.vendor) {
        return res.status(403).json({
          success: false,
          message: "Vendor account is not linked to a vendor.",
        });
      }

      if (
        String(data.vendor?._id || data.vendor) !==
        String(req.user.vendor)
      ) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to access this delivery calculation.",
        });
      }
    }

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get Delivery Calculation Error:", error);

    if (error.message === "Vendor rating not found.") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to retrieve delivery calculation details.",
    });
  }
};