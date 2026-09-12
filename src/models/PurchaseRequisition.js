import mongoose from "mongoose";

const purchaseRequisitionItemSchema = new mongoose.Schema(
  {
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Material",
      required: true,
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

    estimatedCost: {
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
    _id: false,
  }
);

const purchaseRequisitionSchema = new mongoose.Schema(
  {
    // =====================================
    // Basic Information
    // =====================================

    prNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    department: {
      type: String,
      required: true,
      enum: [
        "Production",
        "Purchase",
        "Maintenance",
        "Quality",
        "Stores",
        "Administration",
        "Finance",
      ],
    },

    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    requiredDate: {
      type: Date,
      required: true,
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

    purpose: {
      type: String,
      trim: true,
      default: "",
    },

    // =====================================
    // Materials
    // =====================================

    items: {
      type: [purchaseRequisitionItemSchema],
      validate: [
        (items) => items.length > 0,
        "At least one material is required.",
      ],
    },

    totalEstimatedAmount: {
      type: Number,
      default: 0,
    },

    // =====================================
    // Workflow
    // =====================================

    status: {
      type: String,
      enum: [
        "Draft",
        "Submitted",
        "Approved",
        "Rejected",
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
      default: "",
    },

    // =====================================
    // Audit
    // =====================================

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

// ============================
// Indexes
// ============================



purchaseRequisitionSchema.index({ status: 1 });

purchaseRequisitionSchema.index({ department: 1 });

purchaseRequisitionSchema.index({ requiredDate: 1 });

purchaseRequisitionSchema.index({ createdAt: -1 });

purchaseRequisitionSchema.index({ isDeleted: 1 });

export default mongoose.model(
  "PurchaseRequisition",
  purchaseRequisitionSchema
);