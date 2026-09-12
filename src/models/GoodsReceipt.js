import mongoose from "mongoose";

/**
 * =========================================================
 * GOODS RECEIPT ITEM SCHEMA
 * =========================================================
 *
 * A GRN can contain multiple materials.
 *
 * Important:
 * - This schema records PHYSICAL RECEIPT.
 * - Quality acceptance/rejection is handled separately
 *   by the Quality Inspection module.
 */

const goodsReceiptItemSchema = new mongoose.Schema(
  {
    // =====================================================
    // MATERIAL
    // =====================================================

    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Material",
      required: true,
    },

    /**
     * Snapshot values from the Dispatch/PO.
     * These preserve the material information at the
     * time the GRN was created.
     */
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

    // =====================================================
    // QUANTITY INFORMATION
    // =====================================================

    /**
     * Original PO quantity for this material.
     */
    orderedQuantity: {
      type: Number,
      required: true,
      min: [0, "Ordered quantity cannot be negative."],
    },

    /**
     * Quantity included in the selected Dispatch.
     */
    dispatchedQuantity: {
      type: Number,
      required: true,
      min: [0, "Dispatched quantity cannot be negative."],
    },

    /**
     * Quantity already received through previous GRNs
     * for this PO/material.
     */
    previouslyReceivedQuantity: {
      type: Number,
      default: 0,
      min: [0, "Previously received quantity cannot be negative."],
    },

    /**
     * Actual physical quantity received in THIS GRN.
     *
     * This is entered/confirmed by Admin.
     */
    receivedQuantity: {
      type: Number,
      required: true,
      min: [0, "Received quantity cannot be negative."],
    },

    /**
     * Total quantity received after this GRN.
     *
     * This value is calculated by the service layer:
     *
     * previouslyReceivedQuantity + receivedQuantity
     *
     * It should not be trusted from the frontend.
     */
    totalReceivedQuantity: {
      type: Number,
      default: 0,
      min: [0, "Total received quantity cannot be negative."],
    },

    /**
     * Quantity physically short during this receipt.
     *
     * Calculated by the backend.
     */
    shortQuantity: {
      type: Number,
      default: 0,
      min: [0, "Short quantity cannot be negative."],
    },

    /**
     * Quantity found physically damaged during receipt.
     *
     * This is NOT the same as Quality Inspection rejection.
     * Formal quality rejection will be recorded later.
     */
    damageQuantity: {
      type: Number,
      default: 0,
      min: [0, "Damage quantity cannot be negative."],
    },

    /**
     * Item-specific receiving remarks.
     */
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
 * GOODS RECEIPT SCHEMA
 * =========================================================
 */

const goodsReceiptSchema = new mongoose.Schema(
  {
    // =====================================================
    // GRN IDENTIFICATION
    // =====================================================

    /**
     * Example:
     * GRN-000001
     */
    grnNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // =====================================================
    // REFERENCES
    // =====================================================

    /**
     * Purchase Order associated with this GRN.
     */
    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      required: true,
    },

    /**
     * EXACT Dispatch associated with this receipt.
     *
     * Existing project model:
     * mongoose.model("Dispatch", dispatchSchema)
     */
    dispatch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dispatch",
      required: true,
    },

    /**
     * Vendor who supplied the material.
     */
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },

    // =====================================================
    // RECEIPT INFORMATION
    // =====================================================

    /**
     * Actual date on which Admin received the shipment.
     */
    receiptDate: {
      type: Date,
      required: true,
    },

    /**
     * User who physically recorded the receipt.
     */
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    /**
     * Receiving department/location.
     */
    department: {
      type: String,
      trim: true,
      default: "",
    },

    // =====================================================
    // WORKFLOW STATUS
    // =====================================================

    status: {
      type: String,
      enum: [
        "Draft",
        "Received",
        "Quality Check",
        "Completed",
        "Cancelled",
      ],
      default: "Draft",
    },

    // =====================================================
    // RECEIPT TYPE
    // =====================================================

    /**
     * Normal:
     * Original Vendor Dispatch → GRN
     *
     * Replacement:
     * Replacement Dispatch → GRN
     */
    receiptType: {
      type: String,
      enum: [
        "Normal",
        "Replacement",
      ],
      default: "Normal",
    },

    // =====================================================
    // REPLACEMENT REFERENCE
    // =====================================================

    /**
     * Used only when this GRN is for a replacement
     * dispatch.
     *
     * Existing project model:
     * mongoose.model("ReplacementRequest", ...)
     */
    replacementRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReplacementRequest",
      default: null,
    },

    // =====================================================
    // ITEMS
    // =====================================================

    items: {
      type: [goodsReceiptItemSchema],

      validate: [
        (items) =>
          Array.isArray(items) &&
          items.length > 0,

        "At least one material is required for a GRN.",
      ],
    },

    // =====================================================
    // DOCUMENTS
    // =====================================================

    documents: [
      {
        documentType: {
          type: String,
          enum: [
            "Delivery Challan",
            "Goods Receipt Proof",
            "Invoice Copy",
            "Packing List",
            "Other",
          ],
          default: "Other",
        },

        fileName: {
          type: String,
          trim: true,
          default: "",
        },

        fileUrl: {
          type: String,
          trim: true,
          default: "",
        },

        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },

        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // =====================================================
    // QUALITY INSPECTION REFERENCE
    // =====================================================

    /**
     * This will be populated after the Quality Inspection
     * module is implemented.
     *
     * GRN does NOT decide accepted/rejected quantity.
     */
    qualityInspection: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QualityInspection",
      default: null,
    },

    // =====================================================
    // REMARKS
    // =====================================================

    remarks: {
      type: String,
      trim: true,
      default: "",
    },

    // =====================================================
    // AUDIT INFORMATION
    // =====================================================

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
 * DATABASE INDEXES
 * =========================================================
 */

goodsReceiptSchema.index({
  purchaseOrder: 1,
});

goodsReceiptSchema.index({
  dispatch: 1,
});

goodsReceiptSchema.index({
  vendor: 1,
});

goodsReceiptSchema.index({
  status: 1,
});

goodsReceiptSchema.index({
  receiptType: 1,
});

goodsReceiptSchema.index({
  receiptDate: -1,
});

goodsReceiptSchema.index({
  createdAt: -1,
});

goodsReceiptSchema.index({
  isDeleted: 1,
});


/**
 * =========================================================
 * EXPORT MODEL
 * =========================================================
 */

export default mongoose.model(
  "GoodsReceipt",
  goodsReceiptSchema
);

