import Vendor from "../models/Vendor.js";
import VendorRating from "../models/VendorRating.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import Dispatch from "../models/Dispatch.js";
import GoodsReceipt from "../models/GoodsReceipt.js";
import QualityInspection from "../models/QualityInspection.js";

/**
 * =========================================================
 * ADMIN VENDOR RATING DASHBOARD SERVICE
 * =========================================================
 *
 * PURPOSE
 * ---------------------------------------------------------
 * Provides analytics for the ADMIN Vendor Rating Dashboard.
 *
 * IMPORTANT
 * ---------------------------------------------------------
 * VendorRating remains the source of truth for the actual
 * vendor rating calculation.
 *
 * This service DOES NOT recalculate the vendor rating formula.
 *
 * It only:
 *
 * - reads VendorRating
 * - reads Vendors
 * - reads Purchase Orders
 * - reads Dispatches
 * - reads Goods Receipts
 * - reads Quality Inspections
 * - aggregates dashboard information
 *
 * Rating score scale:
 *
 * 0 - 100
 *
 * Example:
 *
 * 80 / 100 = 4.0 / 5
 * 90 / 100 = 4.5 / 5
 * 70 / 100 = 3.5 / 5
 *
 * =========================================================
 */


/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

const toNumber = (value) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
};


const round = (
  value,
  decimals = 2
) => {
  const multiplier =
    Math.pow(10, decimals);

  return (
    Math.round(
      toNumber(value) * multiplier
    ) / multiplier
  );
};


/**
 * Convert 0-100 score into 0-5 rating.
 */
const scoreToFive = (score) => {
  if (
    score === null ||
    score === undefined ||
    score === ""
  ) {
    return null;
  }

  return round(
    toNumber(score) / 20
  );
};


const startOfDay = (date) => {
  if (!date) {
    return null;
  }

  const value = new Date(date);

  if (
    Number.isNaN(
      value.getTime()
    )
  ) {
    return null;
  }

  value.setHours(
    0,
    0,
    0,
    0
  );

  return value;
};


const endOfDay = (date) => {
  if (!date) {
    return null;
  }

  const value = new Date(date);

  if (
    Number.isNaN(
      value.getTime()
    )
  ) {
    return null;
  }

  value.setHours(
    23,
    59,
    59,
    999
  );

  return value;
};


/**
 * =========================================================
 * DATE VALIDATION
 * =========================================================
 */

const validateDateRange = ({
  fromDate,
  toDate,
} = {}) => {

  if (!fromDate && !toDate) {
    return;
  }

  if (
    fromDate &&
    Number.isNaN(
      new Date(fromDate).getTime()
    )
  ) {
    throw new Error(
      "Invalid fromDate."
    );
  }

  if (
    toDate &&
    Number.isNaN(
      new Date(toDate).getTime()
    )
  ) {
    throw new Error(
      "Invalid toDate."
    );
  }

  if (
    fromDate &&
    toDate &&
    startOfDay(fromDate) >
      endOfDay(toDate)
  ) {
    throw new Error(
      "fromDate cannot be after toDate."
    );
  }
};


/**
 * =========================================================
 * BUILD CREATED AT QUERY
 * =========================================================
 */

const buildCreatedAtQuery = ({
  fromDate,
  toDate,
} = {}) => {

  if (!fromDate && !toDate) {
    return {};
  }

  const createdAt = {};

  if (fromDate) {
    createdAt.$gte =
      startOfDay(fromDate);
  }

  if (toDate) {
    createdAt.$lte =
      endOfDay(toDate);
  }

  return {
    createdAt,
  };
};


/**
 * =========================================================
 * GET LATEST RATING FOR EACH VENDOR
 * =========================================================
 *
 * IMPORTANT CHANGE
 * ---------------------------------------------------------
 * Draft ratings are NOT excluded anymore.
 *
 * This is necessary because the Admin Dashboard needs to
 * display generated vendor ratings even before approval.
 *
 * Official approval status is still shown separately.
 *
 * Latest rating is determined per vendor.
 *
 * =========================================================
 */

const getLatestRatings = async ({
  fromDate,
  toDate,
} = {}) => {

  const match = {
    isDeleted: false,
  };


  /**
   * Rating date filtering.
   *
   * We prefer evaluationPeriod.fromDate because the rating
   * represents a particular evaluation period.
   */
  if (fromDate || toDate) {

    match[
      "evaluationPeriod.fromDate"
    ] = {};

    if (fromDate) {
      match[
        "evaluationPeriod.fromDate"
      ].$gte =
        startOfDay(fromDate);
    }

    if (toDate) {
      match[
        "evaluationPeriod.fromDate"
      ].$lte =
        endOfDay(toDate);
    }
  }


  const ratings =
    await VendorRating.aggregate([

      {
        $match:
          match,
      },

      /**
       * Newest rating first.
       */
      {
        $sort: {
          vendor: 1,
          createdAt: -1,
          _id: -1,
        },
      },

      /**
       * One latest rating per vendor.
       */
      {
        $group: {
          _id: "$vendor",

          rating: {
            $first: "$$ROOT",
          },
        },
      },

      {
        $replaceRoot: {
          newRoot:
            "$rating",
        },
      },

    ]);


  return ratings;
};


/**
 * =========================================================
 * GET VENDOR MAP
 * =========================================================
 */

const getVendorMap = async (
  vendorIds
) => {

  const ids =
    vendorIds
      .filter(Boolean)
      .map(
        (id) => String(id)
      );


  if (ids.length === 0) {
    return new Map();
  }


  const vendors =
    await Vendor.find({
      _id: {
        $in: ids,
      },

      isDeleted: false,
    })
      .select(
        "vendorCode vendorName vendorCategory category status"
      )
      .lean();


  return new Map(
    vendors.map(
      (vendor) => [
        String(vendor._id),
        vendor,
      ]
    )
  );
};


/**
 * =========================================================
 * SUMMARY
 * =========================================================
 */

const calculateSummary = async ({
  ratings,
  fromDate,
  toDate,
}) => {

  const vendorFilter = {
    isDeleted: false,
  };


  /**
   * -------------------------------------------------------
   * TOTAL VENDORS
   * -------------------------------------------------------
   */

  const totalVendors =
    await Vendor.countDocuments(
      vendorFilter
    );


  /**
   * -------------------------------------------------------
   * ACTIVE VENDORS
   * -------------------------------------------------------
   */

  const activeVendors =
    await Vendor.countDocuments({
      ...vendorFilter,

      status: "Active",
    });


  /**
   * -------------------------------------------------------
   * RATED VENDORS
   * -------------------------------------------------------
   *
   * One latest rating per vendor is already supplied by
   * getLatestRatings().
   *
   * A vendor is considered rated if the latest rating has
   * a valid finalOverallScore.
   *
   * Draft is allowed here.
   *
   * -------------------------------------------------------
   */

  const ratedRatings =
    ratings.filter(
      (rating) =>
        rating.finalOverallScore !==
          null &&
        rating.finalOverallScore !==
          undefined
    );


  /**
   * -------------------------------------------------------
   * APPROVED VENDORS
   * -------------------------------------------------------
   *
   * Because ratings are already one-per-vendor, this is
   * automatically a unique vendor count.
   * -------------------------------------------------------
   */

  const approvedVendors =
    ratings.filter(
      (rating) =>
        [
          "Approved",
          "Locked",
        ].includes(
          rating.status
        )
    );


  /**
   * -------------------------------------------------------
   * UNDER REVIEW
   * -------------------------------------------------------
   */

  const vendorsUnderReview =
    ratings.filter(
      (rating) =>
        [
          "Under Review",
          "Submitted",
        ].includes(
          rating.status
        )
    );


  /**
   * -------------------------------------------------------
   * AVERAGE SCORE
   * -------------------------------------------------------
   */

  const averageScore =
    ratedRatings.length > 0
      ? ratedRatings.reduce(
          (
            sum,
            rating
          ) =>
            sum +
            toNumber(
              rating.finalOverallScore
            ),
          0
        ) /
        ratedRatings.length
      : null;


  /**
   * -------------------------------------------------------
   * TOP RATED VENDORS
   * -------------------------------------------------------
   *
   * 80+ is treated as top-performing.
   * -------------------------------------------------------
   */

  const topRatedVendors =
    ratedRatings.filter(
      (rating) =>
        toNumber(
          rating.finalOverallScore
        ) >= 80
    ).length;


  /**
   * -------------------------------------------------------
   * COMPLETED PURCHASE ORDERS
   * -------------------------------------------------------
   *
   * We support the common completed/fulfilled states.
   *
   * If a status does not exist in your enum, MongoDB simply
   * returns zero for that status.
   * -------------------------------------------------------
   */

  const completedPOs =
    await PurchaseOrder.countDocuments({
      isDeleted: false,

      status: {
        $in: [
          "Completed",
          "Delivered",
          "Closed",
          "Fulfilled",
        ],
      },

      ...buildCreatedAtQuery({
        fromDate,
        toDate,
      }),
    });


  /**
   * -------------------------------------------------------
   * GOODS RECEIPT QUERY
   * -------------------------------------------------------
   */

  const receiptMatch = {
    isDeleted: false,

    receiptType: "Normal",

    status: {
      $nin: [
        "Cancelled",
      ],
    },

    ...buildCreatedAtQuery({
      fromDate,
      toDate,
    }),
  };


  /**
   * -------------------------------------------------------
   * TOTAL MATERIAL QUANTITY DELIVERED
   * -------------------------------------------------------
   */

  const receiptAggregation =
    await GoodsReceipt.aggregate([

      {
        $match:
          receiptMatch,
      },

      {
        $unwind: {
          path: "$items",

          preserveNullAndEmptyArrays:
            false,
        },
      },

      {
        $group: {
          _id: null,

          totalReceivedQuantity: {
            $sum: {
              $convert: {
                input: {
                  $ifNull: [
                    "$items.receivedQuantity",
                    0,
                  ],
                },

                to: "double",

                onError: 0,

                onNull: 0,
              },
            },
          },
        },
      },

    ]);


  const totalMaterialsDelivered =
    receiptAggregation.length > 0
      ? toNumber(
          receiptAggregation[0]
            .totalReceivedQuantity
        )
      : 0;


  /**
   * -------------------------------------------------------
   * ON-TIME DELIVERY
   * -------------------------------------------------------
   *
   * Quantity weighted.
   *
   * Instead of:
   *
   *     onTimeReceipts / receipts
   *
   * we calculate:
   *
   *     onTimeQuantity /
   *     evaluatedReceivedQuantity
   *
   * This is much more meaningful for procurement.
   * -------------------------------------------------------
   */

  const receipts =
    await GoodsReceipt.find(
      receiptMatch
    )
      .select(
        "purchaseOrder receiptDate items"
      )
      .lean();


  let onTimeReceipts = 0;

  let evaluatedReceipts = 0;

  let onTimeQuantity = 0;

  let evaluatedQuantity = 0;


  if (receipts.length > 0) {

    const poIds =
      receipts
        .map(
          (receipt) =>
            receipt.purchaseOrder
        )
        .filter(Boolean);


    const purchaseOrders =
      await PurchaseOrder.find({
        _id: {
          $in: poIds,
        },

        isDeleted: false,
      })
        .select(
          "expectedDeliveryDate"
        )
        .lean();


    const poMap =
      new Map(
        purchaseOrders.map(
          (po) => [
            String(po._id),
            po,
          ]
        )
      );


    for (
      const receipt
      of receipts
    ) {

      const po =
        poMap.get(
          String(
            receipt.purchaseOrder
          )
        );


      if (
        !po ||
        !po.expectedDeliveryDate ||
        !receipt.receiptDate
      ) {
        continue;
      }


      const receivedQuantity =
        Array.isArray(
          receipt.items
        )
          ? receipt.items.reduce(
              (
                total,
                item
              ) =>
                total +
                toNumber(
                  item.receivedQuantity
                ),
              0
            )
          : 0;


      evaluatedReceipts += 1;

      evaluatedQuantity +=
        receivedQuantity;


      if (
        new Date(
          receipt.receiptDate
        ) <=
        new Date(
          po.expectedDeliveryDate
        )
      ) {

        onTimeReceipts += 1;

        onTimeQuantity +=
          receivedQuantity;
      }
    }
  }


  const onTimeDeliveryPercentage =
    evaluatedQuantity > 0
      ? round(
          (
            onTimeQuantity /
            evaluatedQuantity
          ) * 100
        )
      : null;


  /**
   * -------------------------------------------------------
   * RETURN SUMMARY
   * -------------------------------------------------------
   */

  return {

    totalVendors,

    activeVendors,

    ratedVendors:
      ratedRatings.length,

    approvedVendors:
      approvedVendors.length,

    activeVendorPercentage:
      totalVendors > 0
        ? round(
            (
              activeVendors /
              totalVendors
            ) * 100
          )
        : 0,

    topRatedVendors,

    vendorsUnderReview:
      vendorsUnderReview.length,

    averageVendorRating:
      averageScore === null
        ? null
        : scoreToFive(
            averageScore
          ),

    averageVendorScore:
      averageScore === null
        ? null
        : round(
            averageScore
          ),

    totalMaterialsDelivered:
      round(
        totalMaterialsDelivered
      ),

    totalPOsCompleted:
      completedPOs,

    onTimeDeliveryPercentage,

    /**
     * Receipt based KPI.
     */
    evaluatedDeliveryReceipts:
      evaluatedReceipts,

    onTimeReceipts,

    /**
     * Quantity based KPI.
     */
    evaluatedDeliveryQuantity:
      round(
        evaluatedQuantity
      ),

    onTimeDeliveryQuantity:
      round(
        onTimeQuantity
      ),
  };
};


/**
 * =========================================================
 * TOP PERFORMING VENDORS
 * =========================================================
 */

const getTopPerformingVendors = async ({
  ratings,
}) => {

  const validRatings =
    ratings.filter(
      (rating) =>
        rating.finalOverallScore !==
          null &&
        rating.finalOverallScore !==
          undefined
    );


  if (
    validRatings.length === 0
  ) {
    return [];
  }


  const vendorIds =
    validRatings.map(
      (rating) =>
        rating.vendor
    );


  const vendorMap =
    await getVendorMap(
      vendorIds
    );


  return validRatings
    .sort(
      (a, b) =>
        toNumber(
          b.finalOverallScore
        ) -
        toNumber(
          a.finalOverallScore
        )
    )
    .slice(
      0,
      5
    )
    .map(
      (
        rating,
        index
      ) => {

        const vendor =
          vendorMap.get(
            String(
              rating.vendor
            )
          );


        return {

          rank:
            index + 1,

          vendorId:
            rating.vendor,

          vendorName:
            vendor?.vendorName ||
            "Unknown Vendor",

          vendorCode:
            vendor?.vendorCode ||
            "",

          category:
            vendor?.vendorCategory ||
            vendor?.category ||
            "",

          status:
            vendor?.status ||
            "",

          overallScore:
            round(
              rating.finalOverallScore
            ),

          overallRating:
            scoreToFive(
              rating.finalOverallScore
            ),

          qualityScore:
            rating.quality?.finalScore !=
            null
              ? round(
                  rating.quality.finalScore
                )
              : null,

          qualityRating:
            scoreToFive(
              rating.quality?.finalScore
            ),

          deliveryScore:
            rating.delivery?.finalScore !=
            null
              ? round(
                  rating.delivery.finalScore
                )
              : null,

          deliveryRating:
            scoreToFive(
              rating.delivery?.finalScore
            ),

          priceScore:
            rating.price?.finalScore !=
            null
              ? round(
                  rating.price.finalScore
                )
              : null,

          priceRating:
            scoreToFive(
              rating.price?.finalScore
            ),

          fulfillmentScore:
            rating.fulfillment?.finalScore !=
            null
              ? round(
                  rating.fulfillment.finalScore
                )
              : null,

          fulfillmentRating:
            scoreToFive(
              rating.fulfillment?.finalScore
            ),

          responseTimeScore:
            rating.responseTime?.finalScore !=
            null
              ? round(
                  rating.responseTime.finalScore
                )
              : null,

          responseTimeRating:
            scoreToFive(
              rating.responseTime?.finalScore
            ),

          totalPurchaseOrders:
            toNumber(
              rating.transactionSummary
                ?.totalPurchaseOrders
            ),

          materialsDelivered:
            toNumber(
              rating.transactionSummary
                ?.totalReceivedQuantity
            ),

          ratingStatus:
            rating.status,

          ratingId:
            rating._id,

          ratingDate:
            rating.createdAt,
        };
      }
    );
};


/**
 * =========================================================
 * RATING DISTRIBUTION
 * =========================================================
 *
 * Uses the actual 0-100 rating score.
 *
 * Mapping:
 *
 * 90-100 = 4.5-5.0
 * 80-89.99 = 4.0-4.49
 * 70-79.99 = 3.5-3.99
 * <70 = below 3.5
 *
 * =========================================================
 */

const calculateRatingDistribution = ({
  ratings,
}) => {

  const distribution = {
    "4.5-5.0": 0,

    "4.0-4.49": 0,

    "3.5-3.99": 0,

    "below-3.5": 0,
  };


  for (
    const rating
    of ratings
  ) {

    if (
      rating.finalOverallScore ===
        null ||
      rating.finalOverallScore ===
        undefined
    ) {
      continue;
    }


    const score =
      toNumber(
        rating.finalOverallScore
      );


    if (score >= 90) {

      distribution[
        "4.5-5.0"
      ] += 1;

    } else if (score >= 80) {

      distribution[
        "4.0-4.49"
      ] += 1;

    } else if (score >= 70) {

      distribution[
        "3.5-3.99"
      ] += 1;

    } else {

      distribution[
        "below-3.5"
      ] += 1;
    }
  }


  const totalRated =
    Object.values(
      distribution
    ).reduce(
      (
        sum,
        value
      ) =>
        sum + value,
      0
    );


  const makeRange = (
    key,
    label,
    scoreRange
  ) => {

    const count =
      distribution[key];


    return {

      key,

      label,

      scoreRange,

      count,

      percentage:
        totalRated > 0
          ? round(
              (
                count /
                totalRated
              ) * 100
            )
          : 0,
    };
  };


  return {

    totalRated,

    ranges: [

      makeRange(
        "4.5-5.0",
        "5.0 - 4.5",
        "90 - 100"
      ),

      makeRange(
        "4.0-4.49",
        "4.4 - 4.0",
        "80 - 89.99"
      ),

      makeRange(
        "3.5-3.99",
        "3.9 - 3.5",
        "70 - 79.99"
      ),

      makeRange(
        "below-3.5",
        "Below 3.5",
        "Below 70"
      ),

    ],
  };
};


/**
 * =========================================================
 * HIGHEST MATERIALS DELIVERED
 * =========================================================
 */

const getHighestMaterialsDelivered = async ({
  fromDate,
  toDate,
}) => {

  const receiptMatch = {

    isDeleted: false,

    receiptType: "Normal",

    status: {
      $nin: [
        "Cancelled",
      ],
    },

    ...buildCreatedAtQuery({
      fromDate,
      toDate,
    }),
  };


  const result =
    await GoodsReceipt.aggregate([

      {
        $match:
          receiptMatch,
      },

      {
        $unwind:
          "$items",
      },

      {
        $group: {

          _id: {
            vendor:
              "$vendor",
          },

          materialsDelivered: {
            $sum: {
              $convert: {

                input: {
                  $ifNull: [
                    "$items.receivedQuantity",
                    0,
                  ],
                },

                to: "double",

                onError: 0,

                onNull: 0,
              },
            },
          },
        },
      },

      {
        $match: {
          "_id.vendor": {
            $ne: null,
          },
        },
      },

      {
        $sort: {
          materialsDelivered:
            -1,
        },
      },

      {
        $limit:
          5,
      },

    ]);


  if (
    result.length === 0
  ) {
    return [];
  }


  const vendorIds =
    result.map(
      (item) =>
        item._id.vendor
    );


  const vendorMap =
    await getVendorMap(
      vendorIds
    );


  return result.map(
    (
      item,
      index
    ) => {

      const vendor =
        vendorMap.get(
          String(
            item._id.vendor
          )
        );


      return {

        rank:
          index + 1,

        vendorId:
          item._id.vendor,

        vendorName:
          vendor?.vendorName ||
          "Unknown Vendor",

        vendorCode:
          vendor?.vendorCode ||
          "",

        category:
          vendor?.vendorCategory ||
          vendor?.category ||
          "",

        status:
          vendor?.status ||
          "",

        materialsDelivered:
          round(
            item.materialsDelivered
          ),
      };
    }
  );
};


/**
 * =========================================================
 * BEST QUALITY VENDORS
 * =========================================================
 */

const getBestQualityVendors = async ({
  ratings,
}) => {

  const validRatings =
    ratings
      .filter(
        (rating) =>
          rating.quality?.finalScore !=
          null
      )
      .sort(
        (a, b) =>
          toNumber(
            b.quality.finalScore
          ) -
          toNumber(
            a.quality.finalScore
          )
      )
      .slice(
        0,
        5
      );


  if (
    validRatings.length === 0
  ) {
    return [];
  }


  const vendorMap =
    await getVendorMap(
      validRatings.map(
        (rating) =>
          rating.vendor
      )
    );


  return validRatings.map(
    (
      rating,
      index
    ) => {

      const vendor =
        vendorMap.get(
          String(
            rating.vendor
          )
        );


      return {

        rank:
          index + 1,

        vendorId:
          rating.vendor,

        vendorName:
          vendor?.vendorName ||
          "Unknown Vendor",

        vendorCode:
          vendor?.vendorCode ||
          "",

        category:
          vendor?.vendorCategory ||
          vendor?.category ||
          "",

        qualityScore:
          round(
            rating.quality.finalScore
          ),

        qualityRating:
          scoreToFive(
            rating.quality.finalScore
          ),

        rejectionPercentage:
          rating.quality
            ?.rejectionPercentage !=
          null
            ? round(
                rating.quality
                  .rejectionPercentage
              )
            : null,

        damagePercentage:
          rating.quality
            ?.damagePercentage !=
          null
            ? round(
                rating.quality
                  .damagePercentage
              )
            : null,

        ratingStatus:
          rating.status,

        ratingId:
          rating._id,
      };
    }
  );
};


/**
 * =========================================================
 * BEST DELIVERY VENDORS
 * =========================================================
 */

const getBestDeliveryVendors = async ({
  ratings,
}) => {

  const validRatings =
    ratings
      .filter(
        (rating) =>
          rating.delivery?.finalScore !=
          null
      )
      .sort(
        (a, b) =>
          toNumber(
            b.delivery.finalScore
          ) -
          toNumber(
            a.delivery.finalScore
          )
      )
      .slice(
        0,
        5
      );


  if (
    validRatings.length === 0
  ) {
    return [];
  }


  const vendorMap =
    await getVendorMap(
      validRatings.map(
        (rating) =>
          rating.vendor
      )
    );


  return validRatings.map(
    (
      rating,
      index
    ) => {

      const vendor =
        vendorMap.get(
          String(
            rating.vendor
          )
        );


      return {

        rank:
          index + 1,

        vendorId:
          rating.vendor,

        vendorName:
          vendor?.vendorName ||
          "Unknown Vendor",

        vendorCode:
          vendor?.vendorCode ||
          "",

        category:
          vendor?.vendorCategory ||
          vendor?.category ||
          "",

        deliveryScore:
          round(
            rating.delivery.finalScore
          ),

        deliveryRating:
          scoreToFive(
            rating.delivery.finalScore
          ),

        onTimeQuantity:
          round(
            rating.delivery
              ?.onTimeQuantity
          ),

        delayedQuantity:
          round(
            rating.delivery
              ?.delayedQuantity
          ),

        averageDelayDays:
          rating.delivery
            ?.averageDelayDays !=
          null
            ? round(
                rating.delivery
                  .averageDelayDays
              )
            : null,

        ratingStatus:
          rating.status,

        ratingId:
          rating._id,
      };
    }
  );
};


/**
 * =========================================================
 * VENDORS NEEDING ATTENTION
 * =========================================================
 */

const getVendorsNeedingAttention = async ({
  ratings,
}) => {

  const attentionRows = [];


  for (
    const rating
    of ratings
  ) {

    if (
      rating.finalOverallScore ===
        null ||
      rating.finalOverallScore ===
        undefined
    ) {
      continue;
    }


    const overall =
      toNumber(
        rating.finalOverallScore
      );


    const quality =
      rating.quality?.finalScore !=
      null
        ? toNumber(
            rating.quality.finalScore
          )
        : null;


    const delivery =
      rating.delivery?.finalScore !=
      null
        ? toNumber(
            rating.delivery.finalScore
          )
        : null;


    const rejection =
      rating.quality
        ?.rejectionPercentage !=
      null
        ? toNumber(
            rating.quality
              .rejectionPercentage
          )
        : 0;


    const pendingReplacement =
      rating.replacementSummary
        ?.pendingQuantity !=
      null
        ? toNumber(
            rating.replacementSummary
              .pendingQuantity
          )
        : 0;


    const issues = [];


    if (
      rejection >= 10
    ) {
      issues.push({
        issue:
          "High Rejection Rate",

        severity:
          "High",
      });
    }


    if (
      delivery !== null &&
      delivery < 50
    ) {
      issues.push({
        issue:
          "Poor Delivery Performance",

        severity:
          "High",
      });
    }


    if (
      quality !== null &&
      quality < 50
    ) {
      issues.push({
        issue:
          "Low Quality Score",

        severity:
          "High",
      });
    }


    if (
      pendingReplacement > 0
    ) {
      issues.push({
        issue:
          "Pending Replacements",

        severity:
          "Medium",
      });
    }


    if (
      overall < 70 &&
      overall >= 50
    ) {
      issues.push({
        issue:
          "Low Overall Rating",

        severity:
          "Medium",
      });
    }


    if (
      overall < 85 &&
      overall >= 70
    ) {
      issues.push({
        issue:
          "Performance Requires Attention",

        severity:
          "Low",
      });
    }


    /**
     * If the vendor has no problem, don't add it.
     */
    if (
      issues.length === 0
    ) {
      continue;
    }


    /**
     * One dashboard row per vendor.
     *
     * The most severe issue is selected.
     */
    const severityRank = {
      High: 1,
      Medium: 2,
      Low: 3,
    };


    issues.sort(
      (a, b) =>
        severityRank[a.severity] -
        severityRank[b.severity]
    );


    const primaryIssue =
      issues[0];


    attentionRows.push({

      vendorId:
        rating.vendor,

      issue:
        primaryIssue.issue,

      severity:
        primaryIssue.severity,

      allIssues:
        issues,

      overallScore:
        round(
          rating.finalOverallScore
        ),

      overallRating:
        scoreToFive(
          rating.finalOverallScore
        ),

      qualityScore:
        quality,

      deliveryScore:
        delivery,

      ratingStatus:
        rating.status,

      ratingId:
        rating._id,
    });
  }


  const severityRank = {
    High: 1,
    Medium: 2,
    Low: 3,
  };


  attentionRows.sort(
    (a, b) => {

      const severityDifference =
        severityRank[
          a.severity
        ] -
        severityRank[
          b.severity
        ];


      if (
        severityDifference !== 0
      ) {
        return severityDifference;
      }


      return (
        toNumber(
          a.overallScore
        ) -
        toNumber(
          b.overallScore
        )
      );
    }
  );


  const rows =
    attentionRows.slice(
      0,
      10
    );


  const vendorMap =
    await getVendorMap(
      rows.map(
        (row) =>
          row.vendorId
      )
    );


  return rows.map(
    (row) => {

      const vendor =
        vendorMap.get(
          String(
            row.vendorId
          )
        );


      return {

        ...row,

        vendorName:
          vendor?.vendorName ||
          "Unknown Vendor",

        vendorCode:
          vendor?.vendorCode ||
          "",

        category:
          vendor?.vendorCategory ||
          vendor?.category ||
          "",

        vendorStatus:
          vendor?.status ||
          "",
      };
    }
  );
};


/**
 * =========================================================
 * RECENT VENDOR ACTIVITY
 * =========================================================
 */

const getRecentVendorActivity = async ({
  fromDate,
  toDate,
}) => {

  const dateQuery =
    buildCreatedAtQuery({
      fromDate,
      toDate,
    });


  const activity = [];


  /**
   * -------------------------------------------------------
   * PURCHASE ORDERS
   * -------------------------------------------------------
   */

  const purchaseOrders =
    await PurchaseOrder.find({
      isDeleted: false,

      ...dateQuery,
    })
      .populate(
        "vendor",
        "vendorName vendorCode"
      )
      .select(
        "poNumber vendor status createdAt"
      )
      .sort({
        createdAt: -1,
      })
      .limit(10)
      .lean();


  for (
    const po
    of purchaseOrders
  ) {

    activity.push({

      type:
        "purchaseOrder",

      icon:
        "purchase-order",

      vendorId:
        po.vendor?._id ||
        po.vendor ||
        null,

      vendorName:
        po.vendor?.vendorName ||
        "Unknown Vendor",

      title:
        "Purchase Order Created",

      description:
        `${po.vendor?.vendorName || "Vendor"} purchase order ${po.poNumber} was created.`,

      reference:
        po.poNumber,

      status:
        po.status,

      date:
        po.createdAt,
    });
  }


  /**
   * -------------------------------------------------------
   * DISPATCHES
   * -------------------------------------------------------
   */

  const dispatches =
    await Dispatch.find({
      isDeleted: false,

      ...dateQuery,
    })
      .populate(
        "vendor",
        "vendorName vendorCode"
      )
      .select(
        "dispatchNumber vendor status dispatchType createdAt"
      )
      .sort({
        createdAt: -1,
      })
      .limit(10)
      .lean();


  for (
    const dispatch
    of dispatches
  ) {

    activity.push({

      type:
        "dispatch",

      icon:
        "dispatch",

      vendorId:
        dispatch.vendor?._id ||
        dispatch.vendor ||
        null,

      vendorName:
        dispatch.vendor?.vendorName ||
        "Unknown Vendor",

      title:
        "Materials Dispatched",

      description:
        `${dispatch.vendor?.vendorName || "Vendor"} created dispatch ${dispatch.dispatchNumber}.`,

      reference:
        dispatch.dispatchNumber,

      status:
        dispatch.status,

      dispatchType:
        dispatch.dispatchType,

      date:
        dispatch.createdAt,
    });
  }


  /**
   * -------------------------------------------------------
   * GOODS RECEIPTS
   * -------------------------------------------------------
   */

  const receipts =
    await GoodsReceipt.find({
      isDeleted: false,

      receiptType: "Normal",

      status: {
        $nin: [
          "Cancelled",
        ],
      },

      ...dateQuery,
    })
      .populate(
        "vendor",
        "vendorName vendorCode"
      )
      .select(
        "grnNumber vendor status receiptDate createdAt"
      )
      .sort({
        createdAt: -1,
      })
      .limit(10)
      .lean();


  for (
    const receipt
    of receipts
  ) {

    activity.push({

      type:
        "goodsReceipt",

      icon:
        "goods-receipt",

      vendorId:
        receipt.vendor?._id ||
        receipt.vendor ||
        null,

      vendorName:
        receipt.vendor?.vendorName ||
        "Unknown Vendor",

      title:
        "Materials Received",

      description:
        `${receipt.vendor?.vendorName || "Vendor"} materials were received under ${receipt.grnNumber}.`,

      reference:
        receipt.grnNumber,

      status:
        receipt.status,

      date:
        receipt.receiptDate ||
        receipt.createdAt,
    });
  }


  /**
   * -------------------------------------------------------
   * QUALITY INSPECTIONS
   * -------------------------------------------------------
   */

  const inspections =
    await QualityInspection.find({
      isDeleted: false,

      ...dateQuery,
    })
      .populate(
        "vendor",
        "vendorName vendorCode"
      )
      .select(
        "vendor status inspectionDate createdAt"
      )
      .sort({
        createdAt: -1,
      })
      .limit(10)
      .lean();


  for (
    const inspection
    of inspections
  ) {

    activity.push({

      type:
        "qualityInspection",

      icon:
        "quality",

      vendorId:
        inspection.vendor?._id ||
        inspection.vendor ||
        null,

      vendorName:
        inspection.vendor?.vendorName ||
        "Unknown Vendor",

      title:
        "Quality Inspection",

      description:
        `${inspection.vendor?.vendorName || "Vendor"} quality inspection status: ${inspection.status}.`,

      reference:
        null,

      status:
        inspection.status,

      date:
        inspection.inspectionDate ||
        inspection.createdAt,
    });
  }


  /**
   * -------------------------------------------------------
   * VENDOR RATINGS
   * -------------------------------------------------------
   *
   * Draft ratings are intentionally included.
   * -------------------------------------------------------
   */

  const ratings =
    await VendorRating.find({
      isDeleted: false,

      ...dateQuery,
    })
      .populate(
        "vendor",
        "vendorName vendorCode"
      )
      .select(
        "vendor status finalOverallScore createdAt"
      )
      .sort({
        createdAt: -1,
      })
      .limit(10)
      .lean();


  for (
    const rating
    of ratings
  ) {

    activity.push({

      type:
        "vendorRating",

      icon:
        "rating",

      vendorId:
        rating.vendor?._id ||
        rating.vendor ||
        null,

      vendorName:
        rating.vendor?.vendorName ||
        "Unknown Vendor",

      title:
        "Vendor Rating Generated",

      description:
        `${rating.vendor?.vendorName || "Vendor"} rating generated with score ${round(rating.finalOverallScore)} / 100.`,

      reference:
        null,

      status:
        rating.status,

      score:
        rating.finalOverallScore !=
        null
          ? round(
              rating.finalOverallScore
            )
          : null,

      date:
        rating.createdAt,
    });
  }


  return activity
    .filter(
      (item) =>
        item.date
    )
    .sort(
      (a, b) =>
        new Date(b.date) -
        new Date(a.date)
    )
    .slice(
      0,
      10
    );
};


/**
 * =========================================================
 * PERFORMANCE TREND
 * =========================================================
 *
 * Uses ALL generated/scored ratings rather than only
 * approved ratings.
 *
 * This means generated Draft ratings can appear in the
 * Admin analytics trend.
 *
 * =========================================================
 */

const getPerformanceTrend = async ({
  fromDate,
  toDate,
}) => {

  const match = {
    isDeleted: false,

    finalOverallScore: {
      $ne: null,
    },
  };


  if (
    fromDate ||
    toDate
  ) {

    match[
      "evaluationPeriod.fromDate"
    ] =
      {};

    if (fromDate) {
      match[
        "evaluationPeriod.fromDate"
      ].$gte =
        startOfDay(fromDate);
    }

    if (toDate) {
      match[
        "evaluationPeriod.fromDate"
      ].$lte =
        endOfDay(toDate);
    }
  }


  const trend =
    await VendorRating.aggregate([

      {
        $match:
          match,
      },

      {
        $group: {

          _id: {
            year: {
              $year:
                "$evaluationPeriod.fromDate",
            },

            month: {
              $month:
                "$evaluationPeriod.fromDate",
            },
          },

          overallScore: {
            $avg:
              "$finalOverallScore",
          },

          qualityScore: {
            $avg:
              "$quality.finalScore",
          },

          deliveryScore: {
            $avg:
              "$delivery.finalScore",
          },

          fulfillmentScore: {
            $avg:
              "$fulfillment.finalScore",
          },

          priceScore: {
            $avg:
              "$price.finalScore",
          },

          responseTimeScore: {
            $avg:
              "$responseTime.finalScore",
          },

          ratingCount: {
            $sum: 1,
          },

        },
      },

      {
        $sort: {
          "_id.year": 1,

          "_id.month": 1,
        },
      },

    ]);


  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];


  return trend.map(
    (item) => ({

      year:
        item._id.year,

      month:
        item._id.month,

      label:
        `${monthNames[item._id.month - 1]} ${item._id.year}`,

      overallScore:
        round(
          item.overallScore
        ),

      overallRating:
        scoreToFive(
          item.overallScore
        ),

      qualityScore:
        item.qualityScore !=
        null
          ? round(
              item.qualityScore
            )
          : null,

      qualityRating:
        scoreToFive(
          item.qualityScore
        ),

      deliveryScore:
        item.deliveryScore !=
        null
          ? round(
              item.deliveryScore
            )
          : null,

      deliveryRating:
        scoreToFive(
          item.deliveryScore
        ),

      fulfillmentScore:
        item.fulfillmentScore !=
        null
          ? round(
              item.fulfillmentScore
            )
          : null,

      fulfillmentRating:
        scoreToFive(
          item.fulfillmentScore
        ),

      priceScore:
        item.priceScore !=
        null
          ? round(
              item.priceScore
            )
          : null,

      priceRating:
        scoreToFive(
          item.priceScore
        ),

      responseTimeScore:
        item.responseTimeScore !=
        null
          ? round(
              item.responseTimeScore
            )
          : null,

      responseTimeRating:
        scoreToFive(
          item.responseTimeScore
        ),

      ratingCount:
        item.ratingCount,
    })
  );
};


/**
 * =========================================================
 * MAIN ADMIN DASHBOARD ANALYTICS
 * =========================================================
 */

export const getVendorRatingDashboardAnalytics =
  async ({
    fromDate,
    toDate,
  } = {}) => {

    validateDateRange({
      fromDate,
      toDate,
    });


    /**
     * -------------------------------------------------------
     * 1. Latest rating for every vendor
     * -------------------------------------------------------
     */

    const ratings =
      await getLatestRatings({
        fromDate,
        toDate,
      });


    /**
     * -------------------------------------------------------
     * 2. Summary
     * -------------------------------------------------------
     */

    const summary =
      await calculateSummary({
        ratings,
        fromDate,
        toDate,
      });


    /**
     * -------------------------------------------------------
     * 3. Top performing vendors
     * -------------------------------------------------------
     */

    const topPerformingVendors =
      await getTopPerformingVendors({
        ratings,
      });


    /**
     * -------------------------------------------------------
     * 4. Rating distribution
     * -------------------------------------------------------
     */

    const ratingDistribution =
      calculateRatingDistribution({
        ratings,
      });


    /**
     * -------------------------------------------------------
     * 5. Highest materials delivered
     * -------------------------------------------------------
     */

    const highestMaterialsDelivered =
      await getHighestMaterialsDelivered({
        fromDate,
        toDate,
      });


    /**
     * -------------------------------------------------------
     * 6. Best quality vendors
     * -------------------------------------------------------
     */

    const bestQualityVendors =
      await getBestQualityVendors({
        ratings,
      });


    /**
     * -------------------------------------------------------
     * 7. Best delivery vendors
     * -------------------------------------------------------
     */

    const bestDeliveryVendors =
      await getBestDeliveryVendors({
        ratings,
      });


    /**
     * -------------------------------------------------------
     * 8. Vendors needing attention
     * -------------------------------------------------------
     */

    const vendorsNeedingAttention =
      await getVendorsNeedingAttention({
        ratings,
      });


    /**
     * -------------------------------------------------------
     * 9. Recent activity
     * -------------------------------------------------------
     */

    const recentActivity =
      await getRecentVendorActivity({
        fromDate,
        toDate,
      });


    /**
     * -------------------------------------------------------
     * 10. Performance trend
     * -------------------------------------------------------
     */

    const performanceTrend =
      await getPerformanceTrend({
        fromDate,
        toDate,
      });


    /**
     * -------------------------------------------------------
     * FINAL RESPONSE
     * -------------------------------------------------------
     *
     * IMPORTANT:
     * No "success: true" here.
     *
     * The controller already wraps the response.
     * This prevents:
     *
     * data.success
     *
     * from appearing unnecessarily.
     * -------------------------------------------------------
     */

    return {

      summary,

      topPerformingVendors,

      ratingDistribution,

      highestMaterialsDelivered,

      bestQualityVendors,

      bestDeliveryVendors,

      vendorsNeedingAttention,

      recentActivity,

      performanceTrend,

      filters: {

        fromDate:
          fromDate
            ? startOfDay(
                fromDate
              )
            : null,

        toDate:
          toDate
            ? endOfDay(
                toDate
              )
            : null,

      },

      generatedAt:
        new Date(),
    };
};


/**
 * =========================================================
 * DEFAULT EXPORT
 * =========================================================
 */

const vendorRatingDashboardService = {

  getVendorRatingDashboardAnalytics,

};


export default vendorRatingDashboardService;