import mongoose from "mongoose";

const materialSchema = new mongoose.Schema(
  {
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

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MaterialCategory",
      required: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    unitOfMeasure: {
      type: String,
      required: true,
      enum: [
        "Nos",
        "Kg",
        "Gram",
        "Liter",
        "Meter",
        "Feet",
        "Box",
        "Packet",
        "Piece",
        "Roll",
        "Set",
      ],
    },

    standardCost: {
      type: Number,
      required: true,
      min: 0,
    },

    preferredVendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
    },

    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },

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

// Useful indexes
materialSchema.index(
  { materialCode: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
materialSchema.index(
  { materialName: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
materialSchema.index({ category: 1 });
materialSchema.index({ preferredVendor: 1 });
materialSchema.index({ status: 1 });
materialSchema.index({ isDeleted: 1 });

export default mongoose.model("Material", materialSchema);