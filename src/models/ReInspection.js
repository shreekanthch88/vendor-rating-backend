import mongoose from "mongoose";


// =========================================================
// RE-INSPECTION ITEM
// =========================================================

const reInspectionItemSchema = new mongoose.Schema(
  {
    material: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Material",
      required: true,
    },

    materialCode: {
      type: String,
      trim: true,
    },

    materialName: {
      type: String,
      trim: true,
      required: true,
    },

    inspectionQuantity: {
      type: Number,
      required: true,
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

    remarks: {
      type: String,
      trim: true,
    },
  },
  {
    _id: true,
  }
);


// =========================================================
// RE-INSPECTION
// =========================================================

const reInspectionSchema = new mongoose.Schema(
  {

    // -----------------------------------------------------
    // IDENTIFICATION
    // -----------------------------------------------------

    reInspectionNumber: {
      type: String,
      unique: true,
      trim: true,
    },


    // -----------------------------------------------------
    // ORIGINAL QUALITY INSPECTION
    // -----------------------------------------------------

    originalInspection: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QualityInspection",
      required: true,
      index: true,
    },


    // -----------------------------------------------------
    // SOURCE TYPE
    // -----------------------------------------------------

    reinspectionType: {
      type: String,
      enum: [
        "ORIGINAL_MATERIAL",
        "REPLACEMENT_MATERIAL",
      ],
      required: true,
    },


    // -----------------------------------------------------
    // GRN
    // -----------------------------------------------------

    goodsReceipt: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GoodsReceipt",
      required: true,
      index: true,
    },


    // -----------------------------------------------------
    // PURCHASE ORDER
    // -----------------------------------------------------

    purchaseOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      required: true,
      index: true,
    },


    // -----------------------------------------------------
    // VENDOR
    // -----------------------------------------------------

    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },


    // -----------------------------------------------------
    // REASON
    // -----------------------------------------------------

    reason: {
      type: String,
      required: true,
      trim: true,
    },


    // -----------------------------------------------------
    // ITEMS
    // -----------------------------------------------------

    items: {
      type: [reInspectionItemSchema],
      default: [],
    },


    // -----------------------------------------------------
    // FINAL RESULT
    // -----------------------------------------------------

    overallResult: {
      type: String,
      enum: [
        "Pending",
        "Accepted",
        "Partially Accepted",
        "Rejected",
        "Accepted with Damage",
        "Conditional Acceptance",
      ],
      default: "Pending",
    },


    // -----------------------------------------------------
    // STATUS
    // -----------------------------------------------------

    status: {
      type: String,
      enum: [
        "Draft",
        "In Progress",
        "Completed",
        "Cancelled",
      ],
      default: "Draft",
      index: true,
    },


    // -----------------------------------------------------
    // REMARKS
    // -----------------------------------------------------

    remarks: {
      type: String,
      trim: true,
    },


    // -----------------------------------------------------
    // AUDIT
    // -----------------------------------------------------

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    completedAt: {
      type: Date,
    },

  },
  {
    timestamps: true,
  }
);


// =========================================================
// AUTO-GENERATE RE-INSPECTION NUMBER
// =========================================================

reInspectionSchema.pre(
  "save",
  async function () {

    if (
      !this.isNew ||
      this.reInspectionNumber
    ) {
      return ;
    }

    const count =
      await mongoose
        .model("ReInspection")
        .countDocuments();

    const sequence =
      String(count + 1)
        .padStart(5, "0");

    this.reInspectionNumber =
      `RI-${sequence}`;

    

  }
);


// =========================================================
// VALIDATION
// =========================================================

reInspectionSchema.pre(
  "validate",
  function () {

    const items =
      Array.isArray(this.items)
        ? this.items
        : [];

    for (const item of items) {

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


      if (
        accepted +
        rejected +
        damaged >
        inspected
      ) {

        throw new Error(
          
            `Accepted + Rejected + Damaged quantity cannot exceed inspection quantity for ${item.materialName}.`
          
        );

      }

    }

    

  }
);


const ReInspection =
  mongoose.model(
    "ReInspection",
    reInspectionSchema
  );


export default ReInspection;