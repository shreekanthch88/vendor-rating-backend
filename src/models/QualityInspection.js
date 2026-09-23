import mongoose from "mongoose";

/**
 * =========================================================
 * QUALITY INSPECTION PARAMETER
 * =========================================================
 *
 * Used for measurable specifications such as:
 *
 * Thickness
 * Length
 * Weight
 * Diameter
 * Grade
 * Temperature
 * etc.
 */

const inspectionParameterSchema =
  new mongoose.Schema(
    {
      parameterName: {
        type: String,
        required: true,
        trim: true,
      },

      requiredValue: {
        type: String,
        trim: true,
        default: "",
      },

      actualValue: {
        type: String,
        trim: true,
        default: "",
      },

      tolerance: {
        type: String,
        trim: true,
        default: "",
      },

      unit: {
        type: String,
        trim: true,
        default: "",
      },

      result: {
        type: String,
        enum: [
          "Pass",
          "Fail",
          "Not Applicable",
        ],
        default: "Not Applicable",
      },

      remarks: {
        type: String,
        trim: true,
        default: "",
      },
    },
    {
      _id: true,
    }
  );


/**
 * =========================================================
 * QUALITY DEFECT
 * =========================================================
 *
 * Supports:
 *
 * Critical
 * Major
 * Minor
 */

const defectSchema =
  new mongoose.Schema(
    {
      category: {
        type: String,
        enum: [
          "Visual",
          "Dimensional",
          "Functional",
          "Material",
          "Packaging",
          "Documentation",
          "Performance",
          "Other",
        ],
        required: true,
      },

      description: {
        type: String,
        required: true,
        trim: true,
      },

      severity: {
        type: String,
        enum: [
          "Critical",
          "Major",
          "Minor",
        ],
        required: true,
      },

      quantity: {
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
      _id: true,
    }
  );


/**
 * =========================================================
 * QUALITY INSPECTION ITEM
 * =========================================================
 */

const qualityInspectionItemSchema =
  new mongoose.Schema(
    {
      material: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Material",
        required: true,
      },

      materialCode: {
        type: String,
        required: true,
        trim: true,
      },

      materialName: {
        type: String,
        required: true,
        trim: true,
      },

      unitOfMeasure: {
        type: String,
        required: true,
        trim: true,
      },


      // ===================================================
      // QUANTITY TRACEABILITY
      // ===================================================

      orderedQuantity: {
        type: Number,
        required: true,
        min: 0,
      },

      receivedQuantity: {
        type: Number,
        required: true,
        min: 0,
      },

      previouslyInspectedQuantity: {
        type: Number,
        default: 0,
        min: 0,
      },

      inspectionQuantity: {
        type: Number,
        required: true,
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

      inspectionShortQuantity: {
        type: Number,
        default: 0,
        min: 0,
      },


      // ===================================================
      // SAMPLING
      // ===================================================

      inspectionMethod: {
        type: String,
        enum: [
          "100% Inspection",
          "Sampling",
          "Visual Inspection",
          "Dimensional Inspection",
          "Functional Test",
          "Performance Test",
          "Laboratory Test",
          "Document Verification",
          "Other",
        ],
        default: "100% Inspection",
      },

      sampleQuantity: {
        type: Number,
        default: 0,
        min: 0,
      },

      samplePassedQuantity: {
        type: Number,
        default: 0,
        min: 0,
      },

      sampleFailedQuantity: {
        type: Number,
        default: 0,
        min: 0,
      },


      // ===================================================
      // QUALITY RESULT
      // ===================================================

      result: {
        type: String,
        enum: [
          "Accepted",
          "Partially Accepted",
          "Rejected",
          "Accepted with Damage",
          "Conditional Acceptance",
          "Hold",
        ],
        default: "Accepted",
      },


      // ===================================================
      // REPLACEMENT
      // ===================================================

      replacementRequiredQuantity: {
        type: Number,
        default: 0,
        min: 0,
      },

      replacementRequired: {
        type: Boolean,
        default: false,
      },


      // ===================================================
      // SPECIFICATION PARAMETERS
      // ===================================================

      parameters: {
        type: [
          inspectionParameterSchema,
        ],
        default: [],
      },


      // ===================================================
      // DEFECTS
      // ===================================================

      defects: {
        type: [
          defectSchema,
        ],
        default: [],
      },


      // ===================================================
      // ITEM REMARKS
      // ===================================================

      remarks: {
        type: String,
        trim: true,
        default: "",
      },
    },
    {
      _id: true,
    }
  );


/**
 * =========================================================
 * QUALITY INSPECTION
 * =========================================================
 */

const qualityInspectionSchema =
  new mongoose.Schema(
    {

      // ===================================================
      // INSPECTION IDENTIFICATION
      // ===================================================

      inspectionNumber: {
        type: String,
        unique: true,
        required: true,
        trim: true,
      },


      // ===================================================
      // SOURCE DOCUMENTS
      // ===================================================

      purchaseOrder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PurchaseOrder",
        required: true,
      },

      goodsReceipt: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GoodsReceipt",
        required: true,
      },

      dispatch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Dispatch",
        required: true,
      },

      vendor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vendor",
        required: true,
      },


      // ===================================================
      // INSPECTION INFORMATION
      // ===================================================

      inspectionDate: {
        type: Date,
        required: true,
        default: Date.now,
      },

      inspectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      department: {
        type: String,
        trim: true,
        default: "Quality",
      },


      // ===================================================
      // INSPECTION STATUS
      // ===================================================

      status: {
        type: String,
        enum: [
          "Draft",
          "Submitted",
          "Completed",
          "Cancelled",
          "Reinspection Required",
        ],
        default: "Draft",
      },

      currentStep: {
        type: Number,
        default: 2,
        min: 2,
        max: 6,
      },


      // ===================================================
      // OVERALL RESULT
      // ===================================================

      overallResult: {
        type: String,
        enum: [
          "Accepted",
          "Partially Accepted",
          "Rejected",
          "Accepted with Damage",
          "Conditional Acceptance",
          "Hold",
        ],
        default: "Accepted",
      },


      // ===================================================
      // INSPECTION SUMMARY
      // ===================================================

      totalReceivedQuantity: {
        type: Number,
        default: 0,
        min: 0,
      },

      totalInspectedQuantity: {
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

      totalInspectionShortQuantity: {
        type: Number,
        default: 0,
        min: 0,
      },

      totalReplacementQuantity: {
        type: Number,
        default: 0,
        min: 0,
      },


      // ===================================================
      // REPLACEMENT
      // ===================================================

      replacementRequired: {
        type: Boolean,
        default: false,
      },

      replacementRequest: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ReplacementRequest",
        default: null,
      },


      // ===================================================
      // RE-INSPECTION
      // ===================================================

      isReinspection: {
        type: Boolean,
        default: false,
      },

      originalInspection: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "QualityInspection",
        default: null,
      },


      // ===================================================
      // DOCUMENT / CERTIFICATE VERIFICATION
      // ===================================================

      documentationStatus: {
        type: String,
        enum: [
          "Not Required",
          "Verified",
          "Missing",
          "Invalid",
          "Pending",
        ],
        default: "Not Required",
      },


      // ===================================================
      // DEVIATION / CONDITIONAL ACCEPTANCE
      // ===================================================

      deviationRequired: {
        type: Boolean,
        default: false,
      },

      deviationReason: {
        type: String,
        trim: true,
        default: "",
      },

      deviationApproved: {
        type: Boolean,
        default: false,
      },

      deviationApprovedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      deviationApprovalDate: {
        type: Date,
        default: null,
      },


      // ===================================================
      // ITEMS
      // ===================================================

      items: {
        type: [
          qualityInspectionItemSchema,
        ],

        required: true,

        validate: {
          validator: function (items) {

            return (
              Array.isArray(items) &&
              items.length > 0
            );

          },

          message:
            "At least one inspection item is required.",
        },
      },


      // ===================================================
      // DOCUMENTS / EVIDENCE
      // ===================================================

      documents: {
        type: [
          {
            name: {
              type: String,
              trim: true,
            },

            url: {
              type: String,
              trim: true,
            },

            documentType: {
              type: String,
              trim: true,
            },
          },
        ],

        default: [],
      },


      // ===================================================
      // REMARKS
      // ===================================================

      remarks: {
        type: String,
        trim: true,
        default: "",
      },


      // ===================================================
      // AUDIT
      // ===================================================

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
      },
    },

    {
      timestamps: true,
    }
  );


/**
 * =========================================================
 * VALIDATION
 * =========================================================
 */

qualityInspectionSchema.pre(
  "validate",
  function () {

    let totalReceived = 0;
    let totalInspected = 0;
    let totalAccepted = 0;
    let totalRejected = 0;
    let totalDamaged = 0;
    let totalShort = 0;
    let totalReplacement = 0;


    for (const item of this.items || []) {

      const received =
        Number(
          item.receivedQuantity || 0
        );

      const inspected =
        Number(
          item.inspectionQuantity || 0
        );

      const accepted =
        Number(
          item.acceptedQuantity || 0
        );

      const rejected =
        Number(
          item.rejectedQuantity || 0
        );

      const damaged =
        Number(
          item.damagedQuantity || 0
        );

      const short =
        Number(
          item.inspectionShortQuantity || 0
        );


      // ===================================================
      // INSPECTION CANNOT EXCEED RECEIVED
      // ===================================================

      if (inspected > received) {

        return (
          new Error(
            `Inspection quantity cannot exceed received quantity for ${item.materialName}.`
          )
        );

      }


      // ===================================================
      // ACCEPTED + REJECTED + DAMAGED
      // CANNOT EXCEED INSPECTED
      // ===================================================

      if (
        accepted +
          rejected +
          damaged >
        inspected
      ) {

        return (
          new Error(
            `Accepted + Rejected + Damaged quantity cannot exceed inspection quantity for ${item.materialName}.`
          )
        );

      }


      // ===================================================
      // REPLACEMENT QUANTITY
      // ===================================================

      const existingReplacementQuantity =
        Number(
          item.replacementRequiredQuantity || 0
        );

      const maximumReplacementQuantity =
        rejected +
        damaged +
        short;

      if (
        existingReplacementQuantity <= 0 &&
        maximumReplacementQuantity > 0
      ) {

        item.replacementRequiredQuantity =
          maximumReplacementQuantity;

      } else {

        item.replacementRequiredQuantity =
          Math.min(
            existingReplacementQuantity,
            maximumReplacementQuantity
          );

      }

      item.replacementRequired =
        item.replacementRequiredQuantity > 0;


      // ===================================================
      // TOTALS
      // ===================================================

      totalReceived += received;

      totalInspected += inspected;

      totalAccepted += accepted;

      totalRejected += rejected;

      totalDamaged += damaged;

      totalShort += short;

      totalReplacement +=
        item.replacementRequiredQuantity;

    }


    // =====================================================
    // SET HEADER TOTALS
    // =====================================================

    this.totalReceivedQuantity =
      totalReceived;

    this.totalInspectedQuantity =
      totalInspected;

    this.totalAcceptedQuantity =
      totalAccepted;

    this.totalRejectedQuantity =
      totalRejected;

    this.totalDamagedQuantity =
      totalDamaged;

    this.totalInspectionShortQuantity =
      totalShort;

    this.totalReplacementQuantity =
      totalReplacement;

    this.replacementRequired =
      totalReplacement > 0;


// =====================================================
// OVERALL RESULT
// =====================================================
//
// IMPORTANT:
// An approved deviation must take priority over the
// automatic quantity-based result.
//
// Example:
// Accepted quantity = 100
// Rejected quantity = 0
// Deviation approved = true
//
// Result must remain:
// "Conditional Acceptance"
//
// Otherwise, use the normal quantity-based logic.
// =====================================================

if (
  this.deviationRequired === true &&
  this.deviationApproved === true
) {

  this.overallResult =
    "Conditional Acceptance";

} else if (
  totalRejected === 0 &&
  totalDamaged === 0
) {

  this.overallResult =
    "Accepted";

} else if (
  totalAccepted > 0 &&
  (totalRejected > 0 ||
   totalDamaged > 0)
) {

  if (totalDamaged > 0) {

    this.overallResult =
      "Accepted with Damage";

  } else {

    this.overallResult =
      "Partially Accepted";

  }

} else if (
  totalAccepted === 0 &&
  totalRejected > 0
) {

  this.overallResult =
    "Rejected";

  }
}
);


/**
 * =========================================================
 * MODEL
 * =========================================================
 */

const QualityInspection =
  mongoose.model(
    "QualityInspection",
    qualityInspectionSchema
  );


export default QualityInspection;
