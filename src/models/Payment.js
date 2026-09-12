import mongoose from "mongoose";

/**
 * =========================================================
 * PAYMENT QUANTITY RECONCILIATION ITEM SCHEMA
 * =========================================================
 */
const quantityReconciliationItemSchema = new mongoose.Schema(
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

    orderedQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    originalReceivedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    originalRejectedQuantity: {
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

    replacementDispatchedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    replacementAcceptedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    finalAcceptedQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    invoicedQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    paidQuantity: {
      type: Number,
      required: true,
      min: 0,
    },

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: true,
  }
);

/**
 * =========================================================
 * PAYMENT MAIN SCHEMA
 * =========================================================
 */
const paymentSchema = new mongoose.Schema(
  {
    paymentNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      required: true,
      index: true,
    },

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

    paymentDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    currency: {
      type: String,
      default: "INR",
      enum: ["INR", "USD", "EUR"],
    },

    paymentMethod: {
      type: String,
      required: true,
      enum: [
        "NEFT",
        "RTGS",
        "IMPS",
        "Bank Transfer",
        "Cheque",
        "UPI",
        "Cash",
        "Other",
      ],
      default: "NEFT",
    },

    transactionReference: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: [
        "Pending",
        "Processing",
        "Completed",
        "Failed",
        "Cancelled",
      ],
      default: "Completed",
      index: true,
    },

    failureReason: {
      type: String,
      trim: true,
      default: "",
    },

    bankDetails: {
      bankName: { type: String, trim: true, default: "" },
      accountHolder: { type: String, trim: true, default: "" },
      accountNumber: { type: String, trim: true, default: "" },
      ifscCode: { type: String, trim: true, default: "" },
      branch: { type: String, trim: true, default: "" },
    },

    invoiceSnapshot: {
      invoiceNumber: { type: String, trim: true },
      invoiceTotalAmount: { type: Number, default: 0 },
      previouslyPaidAmount: { type: Number, default: 0 },
      currentPaymentAmount: { type: Number, default: 0 },
      remainingBalanceAfterPayment: { type: Number, default: 0 },
      paymentStatusAfterThisPayment: { type: String, default: "Paid" },
    },

    quantityReconciliation: {
      type: [quantityReconciliationItemSchema],
      default: [],
    },

    documents: [
      {
        documentType: {
          type: String,
          enum: [
            "Payment Voucher",
            "Bank Confirmation / Advice",
            "Cheque Copy",
            "Receipt Acknowledgment",
            "Other",
          ],
          default: "Payment Voucher",
        },
        fileName: { type: String, trim: true, default: "" },
        fileUrl: { type: String, trim: true, default: "" },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    notes: {
      type: String,
      trim: true,
      default: "",
    },

    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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

paymentSchema.index({ paymentDate: -1 });
paymentSchema.index({ isDeleted: 1 });

export default mongoose.model("Payment", paymentSchema);

