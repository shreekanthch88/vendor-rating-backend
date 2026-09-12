import mongoose from "mongoose";


// =========================================================
// REPLACEMENT ITEM SCHEMA
// =========================================================

const replacementItemSchema = new mongoose.Schema(
  {
    // =====================================================
    // MATERIAL
    // =====================================================

    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Material",
      required: true,
    },

    materialCode: {
      type: String,
      trim: true,
      required: true,
    },

    materialName: {
      type: String,
      trim: true,
      required: true,
    },

    unitOfMeasure: {
      type: String,
      trim: true,
      required: true,
    },


    // =====================================================
    // ORIGINAL QUALITY INSPECTION QUANTITIES
    // =====================================================

    // Quantity physically received during original receipt
    receivedQuantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    // Original accepted quantity
    originalAcceptedQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },

    // Original rejected quantity
    rejectedQuantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    // Original damaged quantity
    damagedQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },

    // =====================================================
    // SHORT / MISSING QUANTITY
    // =====================================================
    //
    // Quantity ordered but not physically received.
    //
    // IMPORTANT:
    // shortQuantity is NOT part of receivedQuantity.
    //
    // Example:
    //
    // Ordered   = 100
    // Received  = 90
    // Short     = 10
    //
    // Therefore:
    //
    // shortQuantity = 10
    //
    // must not be added to receivedQuantity.
    //

    shortQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },


    // =====================================================
    // REPLACEMENT REQUIREMENT
    // =====================================================

    // Quantity requested for replacement.
    //
    // This is the FINAL replacement quantity decided/requested
    // by the organization.
    //
    // It must not automatically be assumed to be:
    //
    // rejected + damaged + short
    //
    // because the Quality Manager may request a partial
    // replacement.

    replacementQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    // Quantity approved by organization
    replacementApprovedQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },


    // =====================================================
    // REPLACEMENT DISPATCH QUANTITIES
    // =====================================================

    replacementDispatchedQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },


    // =====================================================
    // REPLACEMENT RECEIPT QUANTITIES
    // =====================================================

    replacementReceivedQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },


    // =====================================================
    // REPLACEMENT QUALITY INSPECTION
    // =====================================================

    replacementInspectedQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },

    replacementAcceptedQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },

    replacementRejectedQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },

    replacementDamagedQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },


    // =====================================================
    // PENDING QUANTITIES
    // =====================================================

    // Quantity still pending replacement dispatch
    replacementPendingQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },

    // Quantity received but not yet inspected
    inspectionPendingQuantity: {
      type: Number,
      min: 0,
      default: 0,
    },


    // =====================================================
    // REJECTION INFORMATION
    // =====================================================

    rejectionReason: {
      type: String,
      enum: [
        "Damaged",
        "Defective",
        "Wrong Material",
        "Wrong Quantity",
        "Quality Issue",
        "Expired",
        "Packaging Damage",
        "Other",
        "",
      ],
      default: "",
    },

    rejectionRemarks: {
      type: String,
      trim: true,
      default: "",
    },


    // =====================================================
    // ITEM REMARKS
    // =====================================================

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


// =========================================================
// APPROVAL SCHEMA
// =========================================================

const approvalSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: [
        "Pending",
        "Approved",
        "Rejected",
      ],
      default: "Pending",
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    approvalRemarks: {
      type: String,
      trim: true,
      default: "",
    },

    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    _id: false,
  }
);


// =========================================================
// REPLACEMENT DISPATCH HISTORY
// =========================================================

const replacementDispatchHistorySchema =
  new mongoose.Schema(
    {
      dispatch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Dispatch",
        required: true,
      },

      dispatchNumber: {
        type: String,
        trim: true,
        default: "",
      },

      dispatchDate: {
        type: Date,
        default: null,
      },

      quantity: {
        type: Number,
        min: 0,
        default: 0,
      },

      addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      addedAt: {
        type: Date,
        default: Date.now,
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


// =========================================================
// REPLACEMENT RECEIPT / GRN ITEM
// =========================================================

const replacementReceiptItemSchema =
  new mongoose.Schema(
    {
      material: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Material",
        required: true,
      },

      materialCode: {
        type: String,
        trim: true,
        required: true,
      },

      materialName: {
        type: String,
        trim: true,
        required: true,
      },

      dispatchedQuantity: {
        type: Number,
        min: 0,
        default: 0,
      },

      receivedQuantity: {
        type: Number,
        min: 0,
        default: 0,
      },

      shortQuantity: {
        type: Number,
        min: 0,
        default: 0,
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


// =========================================================
// REPLACEMENT RECEIPT / GRN HISTORY
// =========================================================

const replacementReceiptSchema =
  new mongoose.Schema(
    {
      goodsReceipt: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GoodsReceipt",
        default: null,
      },

      grnNumber: {
        type: String,
        trim: true,
        default: "",
      },

      dispatch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Dispatch",
        default: null,
      },

      receiptDate: {
        type: Date,
        default: null,
      },

      items: {
        type: [replacementReceiptItemSchema],
        default: [],
      },

      receivedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      remarks: {
        type: String,
        trim: true,
        default: "",
      },

      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
    {
      _id: true,
    }
  );


// =========================================================
// REPLACEMENT QUALITY INSPECTION ITEM
// =========================================================

const replacementInspectionItemSchema =
  new mongoose.Schema(
    {
      material: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Material",
        required: true,
      },

      materialCode: {
        type: String,
        trim: true,
        required: true,
      },

      materialName: {
        type: String,
        trim: true,
        required: true,
      },

      receivedQuantity: {
        type: Number,
        min: 0,
        default: 0,
      },

      inspectionQuantity: {
        type: Number,
        min: 0,
        default: 0,
      },

      acceptedQuantity: {
        type: Number,
        min: 0,
        default: 0,
      },

      rejectedQuantity: {
        type: Number,
        min: 0,
        default: 0,
      },

      damagedQuantity: {
        type: Number,
        min: 0,
        default: 0,
      },

      pendingQuantity: {
        type: Number,
        min: 0,
        default: 0,
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


// =========================================================
// REPLACEMENT QUALITY INSPECTION
// =========================================================

const replacementInspectionSchema =
  new mongoose.Schema(
    {
      inspectionNumber: {
        type: String,
        trim: true,
        default: "",
      },

      qualityInspection: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "QualityInspection",
        default: null,
      },

      inspectionDate: {
        type: Date,
        default: null,
      },

      items: {
        type: [replacementInspectionItemSchema],
        default: [],
      },

      overallResult: {
        type: String,
        enum: [
          "Pending",
          "Accepted",
          "Partially Accepted",
          "Rejected",
          "Accepted with Damage",
        ],
        default: "Pending",
      },

      remarks: {
        type: String,
        trim: true,
        default: "",
      },

      inspectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },

      completedAt: {
        type: Date,
        default: null,
      },
    },
    {
      _id: false,
    }
  );


// =========================================================
// COMPLETION SCHEMA
// =========================================================

const completionSchema = new mongoose.Schema(
  {
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    completedDate: {
      type: Date,
      default: null,
    },

    completionRemarks: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    _id: false,
  }
);


// =========================================================
// HISTORY / AUDIT SCHEMA
// =========================================================

const historySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
    },

    previousStatus: {
      type: String,
      trim: true,
      default: "",
    },

    newStatus: {
      type: String,
      trim: true,
      default: "",
    },

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    performedAt: {
      type: Date,
      default: Date.now,
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


// =========================================================
// MAIN REPLACEMENT REQUEST SCHEMA
// =========================================================

const replacementRequestSchema =
  new mongoose.Schema(
    {
      // ===================================================
      // IDENTIFICATION
      // ===================================================

      requestNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true,
      },


      // ===================================================
      // REFERENCES
      // ===================================================

      purchaseOrder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PurchaseOrder",
        required: true,
        index: true,
      },

      vendor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vendor",
        required: true,
        index: true,
      },

      originalDispatch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Dispatch",
        required: true,
      },

      parentReplacementRequest: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "ReplacementRequest",
  default: null,
},

replacementCycle: {
  type: Number,
  default: 1,
  min: 1,
},

      goodsReceipt: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GoodsReceipt",
        default: null,
      },

      qualityInspection: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "QualityInspection",
        default: null,
      },


      // ===================================================
      // REPLACEMENT ITEMS
      // ===================================================

      items: {
        type: [replacementItemSchema],

        validate: [
          (items) =>
            Array.isArray(items) &&
            items.length > 0,

          "At least one replacement item is required.",
        ],
      },


      // ===================================================
      // REQUEST DATES
      // ===================================================

      requestedDate: {
        type: Date,
        default: Date.now,
      },

      requiredReplacementDate: {
        type: Date,
        default: null,
      },

      actualReplacementDate: {
        type: Date,
        default: null,
      },


      // ===================================================
      // STATUS
      // ===================================================

      status: {
        type: String,

        enum: [
          "Draft",
          "Pending Approval",
          "Approved",
          "Vendor Accepted",
          "Partially Dispatched",
          "Fully Dispatched",
          "Replacement Dispatched",
          "Replacement In Transit",
          "Partially Received",
          "Fully Received",
          "Replacement Received",
          "Inspection Pending",
          "Inspection Completed",
          "Replacement Required",
          "Completed",
          "Rejected",
          "Cancelled",
        ],

        default: "Draft",

        index: true,
      },


      // ===================================================
      // APPROVAL
      // ===================================================

      approval: {
        type: approvalSchema,
        default: () => ({}),
      },


      // ===================================================
      // VENDOR RESPONSE
      // ===================================================

      vendorResponseDate: {
        type: Date,
        default: null,
      },

      vendorRemarks: {
        type: String,
        trim: true,
        default: "",
      },


      // ===================================================
      // PRIMARY REPLACEMENT DISPATCH
      // ===================================================

      replacementDispatch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Dispatch",
        default: null,
      },


      // ===================================================
      // REPLACEMENT DISPATCH HISTORY
      // ===================================================

      dispatchHistory: {
        type: [replacementDispatchHistorySchema],
        default: [],
      },


      // ===================================================
      // REPLACEMENT RECEIPT / GRN HISTORY
      // ===================================================

      receiptHistory: {
        type: [replacementReceiptSchema],
        default: [],
      },


      // ===================================================
      // REPLACEMENT QUALITY INSPECTION
      // ===================================================

      replacementInspection: {
        type: replacementInspectionSchema,
        default: null,
      },


      // ===================================================
      // OVERALL REASON
      // ===================================================

      reason: {
        type: String,
        trim: true,
        default: "",
      },

      remarks: {
        type: String,
        trim: true,
        default: "",
      },


      // ===================================================
      // COMPLETION
      // ===================================================

      completion: {
        type: completionSchema,
        default: () => ({}),
      },

      completedDate: {
        type: Date,
        default: null,
      },

      completionRemarks: {
        type: String,
        trim: true,
        default: "",
      },


      // ===================================================
      // AUDIT
      // ===================================================

      requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },

      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },


      // ===================================================
      // WORKFLOW HISTORY
      // ===================================================

      history: {
        type: [historySchema],
        default: [],
      },


      // ===================================================
      // SOFT DELETE
      // ===================================================

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


// =========================================================
// INDEXES
// =========================================================

replacementRequestSchema.index({
  purchaseOrder: 1,
  status: 1,
});

replacementRequestSchema.index({
  vendor: 1,
  status: 1,
});

replacementRequestSchema.index({
  originalDispatch: 1,
});

replacementRequestSchema.index({
  goodsReceipt: 1,
});

replacementRequestSchema.index({
  qualityInspection: 1,
});

replacementRequestSchema.index({
  replacementDispatch: 1,
});

replacementRequestSchema.index({
  requestedDate: -1,
});


// =========================================================
// EXPORT
// =========================================================

const ReplacementRequest =
  mongoose.model(
    "ReplacementRequest",
    replacementRequestSchema
  );

export default ReplacementRequest;