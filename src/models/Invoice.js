import mongoose from "mongoose";

/**
 * =========================================================
 * INVOICE ITEM SCHEMA
 * =========================================================
 */
const invoiceItemSchema = new mongoose.Schema(
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

    description: {
      type: String,
      trim: true,
      default: "",
    },

    unitOfMeasure: {
      type: String,
      required: true,
      trim: true,
    },

    orderedQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    receivedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    acceptedQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    invoicedQuantity: {
      type: Number,
      required: true,
      min: 0.001,
    },

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    taxPercentage: {
      type: Number,
      default: 0,
      min: 0,
    },

    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    discountPercentage: {
      type: Number,
      default: 0,
      min: 0,
    },

    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    lineTotal: {
      type: Number,
      required: true,
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
 * INVOICE MAIN SCHEMA
 * =========================================================
 */
const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },

    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      required: true,
      index: true,
    },

    goodsReceipts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "GoodsReceipt",
      },
    ],

    qualityInspections: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "QualityInspection",
      },
    ],

    invoiceDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    dueDate: {
      type: Date,
      required: true,
    },

    currency: {
      type: String,
      default: "INR",
      enum: ["INR", "USD", "EUR"],
    },

    paymentTerms: {
      type: String,
      default: "Net 30",
    },

    items: {
      type: [invoiceItemSchema],
      validate: [
        (items) => Array.isArray(items) && items.length > 0,
        "At least one material item is required to create an invoice.",
      ],
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    freightCharges: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    status: {
      type: String,
      enum: [
        "Draft",
        "Submitted",
        "Under Review",
        "Verified",
        "Approved",
        "Payment Processing",
        "Paid",
        "Rejected",
        "Disputed",
        "Cancelled",
      ],
      default: "Draft",
      index: true,
    },

    verification: {
      isVerified: {
        type: Boolean,
        default: false,
      },
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      verifiedAt: {
        type: Date,
        default: null,
      },
      poMatched: {
        type: Boolean,
        default: false,
      },
      grnMatched: {
        type: Boolean,
        default: false,
      },
      qualityMatched: {
        type: Boolean,
        default: false,
      },
      priceMatched: {
        type: Boolean,
        default: false,
      },
      taxMatched: {
        type: Boolean,
        default: false,
      },
      verificationRemarks: {
        type: String,
        trim: true,
        default: "",
      },
    },

    approval: {
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
      disputeReason: {
        type: String,
        trim: true,
        default: "",
      },
      disputeResolved: {
        type: Boolean,
        default: false,
      },
    },

    payment: {
      paymentStatus: {
        type: String,
        enum: ["Unpaid", "Partially Paid", "Paid"],
        default: "Unpaid",
        index: true,
      },
      paidAmount: {
        type: Number,
        default: 0,
        min: 0,
      },
      outstandingAmount: {
        type: Number,
        default: 0,
        min: 0,
      },
      paymentDate: {
        type: Date,
        default: null,
      },
      paymentReference: {
        type: String,
        trim: true,
        default: "",
      },
      paymentMethod: {
        type: String,
        enum: ["NEFT", "RTGS", "IMPS", "Cheque", "UPI", "Bank Transfer", "Cash", "Other", ""],
        default: "",
      },
      paymentRemarks: {
        type: String,
        trim: true,
        default: "",
      },
      paidBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },

    documents: [
      {
        documentType: {
          type: String,
          enum: [
            "Vendor Invoice",
            "Tax Invoice",
            "Supporting Document",
            "Bank Payment Advice",
            "E-Way Bill",
            "Other",
          ],
          default: "Vendor Invoice",
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
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    vendorRemarks: {
      type: String,
      trim: true,
      default: "",
    },

    adminRemarks: {
      type: String,
      trim: true,
      default: "",
    },

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
 * Indexes for performant search and dashboard aggregation
 */
invoiceSchema.index({ invoiceDate: -1 });
invoiceSchema.index({ dueDate: 1 });
invoiceSchema.index({ isDeleted: 1 });

export default mongoose.model("Invoice", invoiceSchema);
