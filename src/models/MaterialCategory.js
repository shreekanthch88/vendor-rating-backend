import mongoose from "mongoose";

const materialCategorySchema = new mongoose.Schema(
  {
    // ===============================
    // Basic Information
    // ===============================
    categoryCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    categoryName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    // ===============================
    // Category Hierarchy
    // ===============================
    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MaterialCategory",
      default: null,
    },

    // ===============================
    // Status
    // ===============================
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },

    // ===============================
    // Audit
    // ===============================
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // ===============================
    // Soft Delete
    // ===============================
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// ===============================
// Database Indexes
// ===============================

materialCategorySchema.index(
  { categoryCode: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
materialCategorySchema.index(
  { categoryName: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
materialCategorySchema.index({ status: 1 });
materialCategorySchema.index({ parentCategory: 1 });
materialCategorySchema.index({ isDeleted: 1 });

export default mongoose.model(
  "MaterialCategory",
  materialCategorySchema
);