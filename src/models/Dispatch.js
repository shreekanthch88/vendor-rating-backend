import mongoose from "mongoose";

const dispatchItemSchema = new mongoose.Schema(
  {
    // ==========================================
    // Material
    // ==========================================

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

    // ==========================================
    // Quantity
    // ==========================================

    orderedQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    previouslyDispatchedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    dispatchQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    remainingQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ==========================================
    // Replacement
    // ==========================================

    isReplacement: {
      type: Boolean,
      default: false,
    },

    replacementRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReplacementRequest",
      default: null,
    },

    originalDispatch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dispatch",
      default: null,
    },

    // ==========================================
    // Remarks
    // ==========================================

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


// ==================================================
// DISPATCH SCHEMA
// ==================================================

const dispatchSchema = new mongoose.Schema(
  {
    // ==========================================
    // Dispatch Identification
    // ==========================================

    dispatchNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      required: true,
    },

    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },

    // ==========================================
    // Dispatch Dates
    // ==========================================

    dispatchDate: {
      type: Date,
      required: true,
    },

    expectedDeliveryDate: {
      type: Date,
      default: null,
    },

    // ==========================================
    // Dispatch Type
    // ==========================================

    dispatchType: {
      type: String,
      enum: [
        "Full",
        "Partial",
        "Replacement",
      ],
      default: "Full",
    },

    // ==========================================
    // Partial Dispatch
    // ==========================================

    partialDispatchReason: {
      type: String,
      enum: [
        "Stock Shortage",
        "Production Delay",
        "Raw Material Shortage",
        "Transportation Constraint",
        "Quality Issue",
        "Other",
        "",
      ],
      default: "",
    },

    partialDispatchRemarks: {
      type: String,
      trim: true,
      default: "",
    },

    expectedRemainingDeliveryDate: {
      type: Date,
      default: null,
    },

    // ==========================================
    // Transport Information
    // ==========================================

    transporterName: {
      type: String,
      trim: true,
      default: "",
    },

    vehicleNumber: {
      type: String,
      trim: true,
      default: "",
    },

    driverName: {
      type: String,
      trim: true,
      default: "",
    },

    driverContact: {
      type: String,
      trim: true,
      default: "",
    },

    shippingMethod: {
      type: String,
      enum: [
        "Road",
        "Rail",
        "Air",
        "Courier",
        "Other",
        "",
      ],
      default: "",
    },

    // ==========================================
    // Tracking
    // ==========================================

    lrNumber: {
      type: String,
      trim: true,
      default: "",
    },

    trackingNumber: {
      type: String,
      trim: true,
      default: "",
    },

    awbNumber: {
      type: String,
      trim: true,
      default: "",
    },

    consignmentNumber: {
      type: String,
      trim: true,
      default: "",
    },

    // ==========================================
    // Package Information
    // ==========================================

    packageCount: {
      type: Number,
      min: 0,
      default: 0,
    },

    totalWeight: {
      type: Number,
      min: 0,
      default: 0,
    },

    weightUnit: {
      type: String,
      enum: [
        "Kg",
        "Ton",
        "",
      ],
      default: "Kg",
    },

    packageType: {
      type: String,
      trim: true,
      default: "",
    },

    // ==========================================
    // Dispatch Items
    // ==========================================

    items: {
      type: [dispatchItemSchema],
      validate: [
        (items) => items.length > 0,
        "At least one dispatch item is required.",
      ],
    },

    // ==========================================
    // Status
    // ==========================================

    status: {
      type: String,
      enum: [
        "Draft",
        "Dispatched",
        "In Transit",
        "Delivered",
        "Cancelled",
      ],
      default: "Draft",
    },


    // ==========================================
// Tracking History
// ==========================================

trackingHistory: [
  {
    status: {
      type: String,
      enum: [
        "Draft",
        "Dispatched",
        "In Transit",
        "Delivered",
        "Cancelled",
      ],
      required: true,
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
    },

    location: {
      type: String,
      trim: true,
      default: "",
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
],

    // ==========================================
    // Documents
    // ==========================================

    documents: [
      {
        documentType: {
          type: String,
          enum: [
            "Delivery Challan",
            "Packing List",
            "E-Way Bill",
            "LR / Consignment Note",
            "Other",
          ],
        },

        fileName: {
          type: String,
          trim: true,
        },

        fileUrl: {
          type: String,
          trim: true,
        },

        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // ==========================================
    // Remarks
    // ==========================================

    remarks: {
      type: String,
      trim: true,
      default: "",
    },

    // ==========================================
    // Audit
    // ==========================================

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


// ==================================================
// INDEXES
// ==================================================

dispatchSchema.index({
  purchaseOrder: 1,
});

dispatchSchema.index({
  vendor: 1,
});

dispatchSchema.index({
  status: 1,
});

dispatchSchema.index({
  dispatchDate: -1,
});

dispatchSchema.index({
  expectedDeliveryDate: 1,
});

dispatchSchema.index({
  "items.material": 1,
});


// ==================================================
// MODEL
// ==================================================

export default mongoose.model(
  "Dispatch",
  dispatchSchema
);