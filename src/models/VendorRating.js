import mongoose from "mongoose";

/**
 * =========================================================
 * VENDOR RATING MECHANISM
 * =========================================================
 *
 * This model stores a Vendor Rating evaluation snapshot.
 *
 * Important architecture:
 *
 * Existing transaction models remain the source of truth:
 *
 * PurchaseOrder
 * VendorDispatch
 * GoodsReceipt
 * QualityInspection
 * ReInspection
 * ReplacementRequest
 * Material
 *
 * VendorRating stores the calculated/evaluated result.
 *
 * Every parameter contains:
 *
 * systemScore
 * evaluatorScore
 * finalScore
 * weight
 * adjustment
 * adjustmentReason
 *
 * =========================================================
 */


/**
 * =========================================================
 * PARAMETER SCORE SCHEMA
 * =========================================================
 *
 * Common structure used by all 8 rating parameters.
 *
 * systemScore:
 * Score automatically calculated from transaction data.
 *
 * evaluatorScore:
 * Score entered/reviewed by authorized evaluator.
 *
 * finalScore:
 * Score finally used in overall calculation.
 *
 * adjustment:
 * Difference between evaluator score and system score.
 *
 * adjustmentReason:
 * Mandatory when evaluator changes the system score.
 *
 * evidenceCount:
 * Number of transactions/evidence records used.
 *
 * remarks:
 * Additional evaluator remarks.
 *
 * =========================================================
 */

const parameterScoreSchema = new mongoose.Schema(
  {
    systemScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    evaluatorScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    finalScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    weight: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    adjustment: {
      type: Number,
      default: 0,
    },

    adjustmentReason: {
      type: String,
      trim: true,
      default: "",
    },

    evidenceCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    _id: false,
  }
);


/**
 * =========================================================
 * DELIVERY EVIDENCE
 * =========================================================
 *
 * Supports:
 *
 * - Full dispatch
 * - Partial dispatch
 * - Multiple dispatches
 * - Pending quantities
 * - Committed remaining delivery dates
 * - Actual receipt
 * - Delay tracking
 * - Replacement delivery evidence
 *
 * =========================================================
 */

const deliverySchema = new mongoose.Schema(
  {
    systemScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    evaluatorScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    finalScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    weight: {
      type: Number,
      default: 30,
      immutable: true,
    },

    adjustment: {
      type: Number,
      default: 0,
    },

    adjustmentReason: {
      type: String,
      trim: true,
      default: "",
    },

    totalOrdersEvaluated: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalDispatchesEvaluated: {
      type: Number,
      default: 0,
      min: 0,
    },

    orderedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    dispatchedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    receivedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    onTimeQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    delayedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalDelayDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    averageDelayDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    partialDispatchCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    multipleDispatchPOCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    dimensions: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    _id: false,
  }
);


/**
 * =========================================================
 * QUALITY EVIDENCE
 * =========================================================
 *
 * IMPORTANT:
 *
 * Accepted-with-deviation is NOT the same as rejection.
 *
 * Damage Accepted is NOT the same as Damage Rejected.
 *
 * We preserve every quantity separately.
 *
 * =========================================================
 */

const qualitySchema = new mongoose.Schema(
  {
    systemScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    evaluatorScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    finalScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    weight: {
      type: Number,
      default: 25,
      immutable: true,
    },

    adjustment: {
      type: Number,
      default: 0,
    },

    adjustmentReason: {
      type: String,
      trim: true,
      default: "",
    },

    inspectedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    normalAcceptedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    deviationQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    deviationAcceptedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    deviationRejectedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    damagedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    damagedAcceptedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    damagedRejectedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    normalRejectedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalRejectedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalDamagedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    defectPercentage: {
      type: Number,
      default: 0,
      min: 0,
    },

    rejectionPercentage: {
      type: Number,
      default: 0,
      min: 0,
    },

    damagePercentage: {
      type: Number,
      default: 0,
      min: 0,
    },

    deviationCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    reInspectionCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    replacementQualityCases: {
      type: Number,
      default: 0,
      min: 0,
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    _id: false,
  }
);


/**
 * =========================================================
 * FULFILLMENT EVIDENCE
 * =========================================================
 *
 * Tracks:
 *
 * Ordered
 * Dispatched
 * Received
 * Original accepted
 * Replacement accepted
 * Final fulfilled
 * Pending
 *
 * =========================================================
 */

const fulfillmentSchema = new mongoose.Schema(
  {
    systemScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    evaluatorScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    finalScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    weight: {
      type: Number,
      default: 15,
      immutable: true,
    },

    adjustment: {
      type: Number,
      default: 0,
    },

    adjustmentReason: {
      type: String,
      trim: true,
      default: "",
    },

    orderedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    dispatchedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    receivedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    originalAcceptedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    replacementRequestedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    replacementApprovedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    replacementDispatchedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    replacementReceivedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    replacementAcceptedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    finalFulfilledQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    pendingQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    originalPendingQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    replacementPendingQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    fulfillmentPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    _id: false,
  }
);


/**
 * =========================================================
 * PRICE EVIDENCE
 * =========================================================
 */

const priceSchema = new mongoose.Schema(
  {
    systemScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    evaluatorScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    finalScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    weight: {
      type: Number,
      default: 10,
      immutable: true,
    },

    adjustment: {
      type: Number,
      default: 0,
    },

    adjustmentReason: {
      type: String,
      trim: true,
      default: "",
    },

    purchaseOrderCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    referencePriceCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    averageVendorPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    averageReferencePrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    averageVariancePercentage: {
      type: Number,
      default: 0,
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    _id: false,
  }
);


/**
 * =========================================================
 * RESPONSE TIME EVIDENCE
 * =========================================================
 */

const responseTimeSchema = new mongoose.Schema(
  {
    systemScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    evaluatorScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    finalScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    weight: {
      type: Number,
      default: 5,
      immutable: true,
    },

    adjustment: {
      type: Number,
      default: 0,
    },

    adjustmentReason: {
      type: String,
      trim: true,
      default: "",
    },

    responseCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    averageResponseMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },

    fastestResponseMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },

    slowestResponseMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },

    noResponseCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    _id: false,
  }
);


/**
 * =========================================================
 * PO ACCEPTANCE EVIDENCE
 * =========================================================
 */

const poAcceptanceSchema = new mongoose.Schema(
  {
    systemScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    evaluatorScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    finalScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    weight: {
      type: Number,
      default: 5,
      immutable: true,
    },

    adjustment: {
      type: Number,
      default: 0,
    },

    adjustmentReason: {
      type: String,
      trim: true,
      default: "",
    },

    totalPOs: {
      type: Number,
      default: 0,
      min: 0,
    },

    acceptedPOs: {
      type: Number,
      default: 0,
      min: 0,
    },

    rejectedPOs: {
      type: Number,
      default: 0,
      min: 0,
    },

    acceptancePercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    _id: false,
  }
);


/**
 * =========================================================
 * DOCUMENTATION EVIDENCE
 * =========================================================
 */

const documentationSchema = new mongoose.Schema(
  {
    systemScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    evaluatorScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    finalScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    weight: {
      type: Number,
      default: 5,
      immutable: true,
    },

    adjustment: {
      type: Number,
      default: 0,
    },

    adjustmentReason: {
      type: String,
      trim: true,
      default: "",
    },

    requiredDocuments: {
      type: Number,
      default: 0,
      min: 0,
    },

    submittedDocuments: {
      type: Number,
      default: 0,
      min: 0,
    },

    validDocuments: {
      type: Number,
      default: 0,
      min: 0,
    },

    missingDocuments: {
      type: Number,
      default: 0,
      min: 0,
    },

    documentationCompliancePercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    _id: false,
  }
);


/**
 * =========================================================
 * COMMUNICATION EVIDENCE
 * =========================================================
 */

const communicationSchema = new mongoose.Schema(
  {
    systemScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    evaluatorScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    finalScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    weight: {
      type: Number,
      default: 5,
      immutable: true,
    },

    adjustment: {
      type: Number,
      default: 0,
    },

    adjustmentReason: {
      type: String,
      trim: true,
      default: "",
    },

    evaluatorRating: {
      type: String,
      enum: [
        "Excellent",
        "Good",
        "Average",
        "Poor",
        null,
      ],
      default: null,
    },

    evaluatorRemarks: {
      type: String,
      trim: true,
      default: "",
    },

    evaluatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    evaluatedAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  }
);


/**
 * =========================================================
 * COMPLAINT EVIDENCE
 * =========================================================
 *
 * Complaint is conditional.
 *
 * No complaints:
 *
 * applicable = false
 * score = null
 *
 * Complaints exist:
 *
 * applicable = true
 * score can be calculated later.
 *
 * Complaint is NOT part of the mandatory 100%
 * weighted parameters.
 *
 * =========================================================
 */

const complaintSchema = new mongoose.Schema(
  {
    applicable: {
      type: Boolean,
      default: false,
    },

    complaintCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    resolvedComplaintCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    openComplaintCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    averageResolutionDays: {
      type: Number,
      default: 0,
      min: 0,
    },

    score: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    _id: false,
  }
);


/**
 * =========================================================
 * REPLACEMENT SUMMARY
 * =========================================================
 *
 * Replacement is supporting evidence.
 *
 * It does NOT add another weighted parameter.
 *
 * =========================================================
 */

const replacementSummarySchema = new mongoose.Schema(
  {
    requestCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    requestedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    approvedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    dispatchedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    receivedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    inspectedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    acceptedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    rejectedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    damagedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    pendingQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    averageResponseHours: {
      type: Number,
      default: 0,
      min: 0,
    },

    averageDeliveryDelayDays: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    _id: false,
  }
);


/**
 * =========================================================
 * RE-INSPECTION SUMMARY
 * =========================================================
 */

const reInspectionSummarySchema = new mongoose.Schema(
  {
    totalReInspections: {
      type: Number,
      default: 0,
      min: 0,
    },

    inspectedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    acceptedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    rejectedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    damagedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    deviationAcceptedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    deviationRejectedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    _id: false,
  }
);


/**
 * =========================================================
 * VENDOR RATING SCHEMA
 * =========================================================
 */

const vendorRatingSchema = new mongoose.Schema(
  {
    /**
     * =======================================================
     * VENDOR
     * =======================================================
     */

    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },


    /**
     * =======================================================
     * EVALUATION PERIOD
     * =======================================================
     */

    evaluationPeriod: {
      fromDate: {
        type: Date,
        required: true,
      },

      toDate: {
        type: Date,
        required: true,
      },
    },


    /**
     * =======================================================
     * RATING PARAMETERS
     * =======================================================
     */

    delivery: {
      type: deliverySchema,
      required: true,
      default: () => ({}),
    },

    quality: {
      type: qualitySchema,
      required: true,
      default: () => ({}),
    },

    fulfillment: {
      type: fulfillmentSchema,
      required: true,
      default: () => ({}),
    },

    price: {
      type: priceSchema,
      required: true,
      default: () => ({}),
    },

    responseTime: {
      type: responseTimeSchema,
      required: true,
      default: () => ({}),
    },

    poAcceptance: {
      type: poAcceptanceSchema,
      required: true,
      default: () => ({}),
    },

    documentation: {
      type: documentationSchema,
      required: true,
      default: () => ({}),
    },

    communication: {
      type: communicationSchema,
      required: true,
      default: () => ({}),
    },


    /**
     * =======================================================
     * CONDITIONAL COMPLAINT INFORMATION
     * =======================================================
     */

    complaint: {
      type: complaintSchema,
      required: true,
      default: () => ({}),
    },


    /**
     * =======================================================
     * SUPPORTING WORKFLOW DATA
     * =======================================================
     */

    replacementSummary: {
      type: replacementSummarySchema,
      required: true,
      default: () => ({}),
    },

    reInspectionSummary: {
      type: reInspectionSummarySchema,
      required: true,
      default: () => ({}),
    },


    /**
     * =======================================================
     * TRANSACTION SUMMARY
     * =======================================================
     */

    transactionSummary: {
      totalPurchaseOrders: {
        type: Number,
        default: 0,
        min: 0,
      },

      completedPurchaseOrders: {
        type: Number,
        default: 0,
        min: 0,
      },

      totalOrderedQuantity: {
        type: Number,
        default: 0,
        min: 0,
      },

      totalDispatchedQuantity: {
        type: Number,
        default: 0,
        min: 0,
      },

      totalReceivedQuantity: {
        type: Number,
        default: 0,
        min: 0,
      },

      totalAcceptedQuantity: {
        type: Number,
        default: 0,
        min: 0,
      },

      totalRejectedQuantity: {
        type: Number,
        default: 0,
        min: 0,
      },

      totalDamagedQuantity: {
        type: Number,
        default: 0,
        min: 0,
      },

      totalPendingQuantity: {
        type: Number,
        default: 0,
        min: 0,
      },
    },


    /**
     * =======================================================
     * OVERALL SCORES
     * =======================================================
     */

    systemOverallScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    evaluatorOverallScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    finalOverallScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },


    /**
     * =======================================================
     * RATING CATEGORY
     * =======================================================
     */

    ratingCategory: {
      type: String,
      enum: [
        "Preferred Vendor",
        "Excellent",
        "Good",
        "Average",
        "Poor",
        null,
      ],
      default: null,
    },


    /**
     * =======================================================
     * EVALUATION STATUS
     * =======================================================
     */

    status: {
      type: String,
      enum: [
        "Draft",
        "Under Review",
        "Submitted",
        "Approved",
        "Locked",
        "Rejected",
      ],
      default: "Draft",
      index: true,
    },


    /**
     * =======================================================
     * EVALUATOR
     * =======================================================
     */

    evaluatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    evaluatedAt: {
      type: Date,
      default: null,
    },


    /**
     * =======================================================
     * APPROVAL
     * =======================================================
     */

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },


    /**
     * =======================================================
     * LOCK
     * =======================================================
     */

    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    lockedAt: {
      type: Date,
      default: null,
    },


    /**
     * =======================================================
     * GENERAL REMARKS
     * =======================================================
     */

    remarks: {
      type: String,
      trim: true,
      default: "",
    },


    /**
     * =======================================================
     * AUDIT
     * =======================================================
     */

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);


/**
 * =========================================================
 * INDEXES
 * =========================================================
 */

vendorRatingSchema.index({
  vendor: 1,
  "evaluationPeriod.fromDate": 1,
  "evaluationPeriod.toDate": 1,
});

vendorRatingSchema.index({
  vendor: 1,
  status: 1,
});

vendorRatingSchema.index({
  vendor: 1,
  createdAt: -1,
});

vendorRatingSchema.index({
  finalOverallScore: -1,
});

vendorRatingSchema.index({
  ratingCategory: 1,
});


/**
 * =========================================================
 * VALIDATION
 * =========================================================
 *
 * Make sure:
 *
 * 1. Evaluation period is valid.
 * 2. Evaluator adjustment has a reason.
 * 3. Final scores remain within 0–100.
 *
 * =========================================================
 */

vendorRatingSchema.pre("validate", function () {
  if (
    this.evaluationPeriod?.fromDate &&
    this.evaluationPeriod?.toDate &&
    this.evaluationPeriod.fromDate >
      this.evaluationPeriod.toDate
  ) {
    throw new Error(
      "Evaluation period start date cannot be after end date."
    );
  }


  const parameters = [
    "delivery",
    "quality",
    "fulfillment",
    "price",
    "responseTime",
    "poAcceptance",
    "documentation",
    "communication",
  ];


  parameters.forEach((parameter) => {
    const data = this[parameter];

    if (!data) {
      return;
    }

    if (
      data.evaluatorScore !== null &&
      data.evaluatorScore !== undefined &&
      data.systemScore !== null &&
      data.systemScore !== undefined
    ) {
      data.adjustment =
        Number(data.evaluatorScore) -
        Number(data.systemScore);

      if (
        data.evaluatorScore !==
          data.systemScore &&
        !String(
          data.adjustmentReason || ""
        ).trim()
      ) {
        throw new Error(
          `${parameter} adjustment reason is required when evaluator score differs from system score.`
        );
      }
    }

    if (
      data.finalScore !== null &&
      data.finalScore !== undefined
    ) {
      if (
        data.finalScore < 0 ||
        data.finalScore > 100
      ) {
        throw new Error(
          `${parameter} final score must be between 0 and 100.`
        );
      }
    }
  });
});


/**
 * =========================================================
 * EXPORT
 * =========================================================
 */

export default mongoose.model(
  "VendorRating",
  vendorRatingSchema
);