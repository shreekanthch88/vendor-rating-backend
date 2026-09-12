import mongoose from "mongoose";

/**
 * ===========================================
 * Purchase Order Item Schema
 * ===========================================
 */

const purchaseOrderItemSchema = new mongoose.Schema(
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
      default: "",
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    unitOfMeasure: {
      type: String,
      required: true,
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

    discountPercentage: {
      type: Number,
      default: 0,
      min: 0,
    },

    lineTotal: {
      type: Number,
      default: 0,
    },

    remarks: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    _id: false,
  }
);

/**
 * ===========================================
 * Purchase Order Schema
 * ===========================================
 */

const purchaseOrderSchema = new mongoose.Schema(
  {
        /**
     * ===========================================
     * Basic Information
     * ===========================================
     */

    poNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    purchaseRequisition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseRequisition",
      required: true,
    },

    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },

    orderDate: {
      type: Date,
      default: Date.now,
    },

    expectedDeliveryDate: {
      type: Date,
      required: true,
    },

    paymentTerms: {
      type: String,
      required: true,
      enum: [
        "Advance",
        "Cash On Delivery",
        "Net 15",
        "Net 30",
        "Net 45",
        "Net 60",
      ],
      default: "Net 30",
    },

    deliveryLocation: {
      type: String,
      required: true,
      trim: true,
    },

    currency: {
      type: String,
      default: "INR",
      enum: ["INR", "USD", "EUR"],
    },

    priority: {
      type: String,
      enum: [
        "Low",
        "Medium",
        "High",
        "Critical",
      ],
      default: "Medium",
    },

    buyerRemarks: {
      type: String,
      trim: true,
      default: "",
    },

    /**
     * ===========================================
     * Purchase Order Items
     * ===========================================
     */

    items: {
      type: [purchaseOrderItemSchema],
      validate: [
        (items) => items.length > 0,
        "At least one material is required.",
      ],
    },

    /**
     * ===========================================
     * Financial Summary
     * ===========================================
     */

    subtotal: {
      type: Number,
      default: 0,
      min: 0,
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

    grandTotal: {
      type: Number,
      default: 0,
      min: 0,
    },

        /**
     * ===========================================
     * Workflow
     * ===========================================
     */

    status: {
      type: String,
      enum: [
        "Draft",
        "Submitted",
        "Approved",
        "Sent",
        "Accepted",
        "Rejected",
        "Partially Delivered",
        "Delivered",
        "Closed",
        "Cancelled",
      ],
      default: "Draft",
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedDate: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      trim: true,
      default: "",
    },

    /**
     * ===========================================
     * Vendor Response
     * ===========================================
     */

    sentToVendor: {
      type: Boolean,
      default: false,
    },

    sentDate: {
      type: Date,
      default: null,
    },

    vendorAccepted: {
      type: Boolean,
      default: null,
    },

    vendorResponseDate: {
      type: Date,
      default: null,
    },

    vendorRemarks: {
      type: String,
      trim: true,
      default: "",
    },

    /**
     * ===========================================
     * Delivery Tracking
     * ===========================================
     */

    expectedReceiptDate: {
      type: Date,
      default: null,
    },

    actualReceiptDate: {
      type: Date,
      default: null,
    },

    /**
     * ===========================================
     * Audit Information
     * ===========================================
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
    },

  },
  {
    timestamps: true,
  }
);

/**
 * ===========================================
 * Database Indexes
 * ===========================================
 */



purchaseOrderSchema.index({
  purchaseRequisition: 1,
});

purchaseOrderSchema.index({
  vendor: 1,
});

purchaseOrderSchema.index({
  status: 1,
});

purchaseOrderSchema.index({
  expectedDeliveryDate: 1,
});

purchaseOrderSchema.index({
  orderDate: -1,
});

purchaseOrderSchema.index({
  createdAt: -1,
});

purchaseOrderSchema.index({
  isDeleted: 1,
});

/**
 * ===========================================
 * Pre Save Hook
 * Calculate Financial Totals
 * ===========================================
 */

purchaseOrderSchema.pre("save", function () {

  let subtotal = 0;
  let taxAmount = 0;
  let discountAmount = 0;

  this.items.forEach((item) => {

    const lineAmount =
      Number(item.quantity) *
      Number(item.unitPrice);

    const discount =
      (lineAmount *
        Number(item.discountPercentage || 0)) /
      100;

    const taxableAmount =
      lineAmount - discount;

    const tax =
      (taxableAmount *
        Number(item.taxPercentage || 0)) /
      100;

    item.lineTotal =
      taxableAmount + tax;

    subtotal += lineAmount;

    taxAmount += tax;

    discountAmount += discount;

  });

  this.subtotal = subtotal;

  this.taxAmount = taxAmount;

  this.discountAmount = discountAmount;

  this.grandTotal =
    subtotal -
    discountAmount +
    taxAmount +
    Number(this.freightCharges || 0);

  

});

/**
 * ===========================================
 * Export Model
 * ===========================================
 */

export default mongoose.model(
  "PurchaseOrder",
  purchaseOrderSchema
);