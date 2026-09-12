import mongoose from "mongoose";

const vendorSchema = new mongoose.Schema(
  {
    // ===============================
    // Basic Information
    // ===============================
    vendorCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    vendorName: {
      type: String,
      required: true,
      trim: true,
    },

    vendorCategory: {
      type: String,
      enum: [
        "Raw Material",
        "Packaging",
        "Service",
        "Contractor",
        "Transport",
        "Office Supplies",
        "Other",
      ],
      default: "Other",
    },

    businessType: {
      type: String,
      enum: [
        "Manufacturer",
        "Distributor",
        "Wholesaler",
        "Retailer",
        "Service Provider",
      ],
      default: "Manufacturer",
    },

    description: {
      type: String,
      trim: true,
    },

    // ===============================
    // Compliance
    // ===============================
    gstNumber: {
      type: String,
      trim: true,
    },

    panNumber: {
      type: String,
      trim: true,
    },

    msmeNumber: {
      type: String,
      trim: true,
    },

    cinNumber: {
      type: String,
      trim: true,
    },

    // ===============================
    // Contact
    // ===============================
    contactPerson: {
      type: String,
      trim: true,
    },

    designation: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    mobile: {
      type: String,
      trim: true,
    },

    alternateMobile: {
      type: String,
      trim: true,
    },

    website: {
      type: String,
      trim: true,
    },

    // ===============================
    // Address
    // ===============================
    address: {
      line1: String,
      line2: String,
      city: String,
      district: String,
      state: String,
      country: {
        type: String,
        default: "India",
      },
      pincode: String,
    },

    // ===============================
    // Bank Details
    // ===============================
    bankDetails: {
      bankName: String,
      accountHolder: String,
      accountNumber: String,
      ifscCode: String,
      branch: String,
    },

    // ===============================
    // Purchase Configuration
    // ===============================
    paymentTerms: {
      type: String,
      default: "30 Days",
    },

    creditDays: {
      type: Number,
      default: 30,
    },

    preferredVendor: {
      type: Boolean,
      default: false,
    },

    leadTime: {
      type: Number,
      default: 0,
    },

    currency: {
      type: String,
      default: "INR",
    },

    // ===============================
    // Status
    // ===============================
    status: {
      type: String,
      enum: [
        "Pending",
        "Active",
        "Inactive",
        "Blacklisted",
      ],
      default: "Pending",
    },

    // ===============================
    // Performance
    // ===============================
    performance: {
      totalOrders: {
        type: Number,
        default: 0,
      },

      completedOrders: {
        type: Number,
        default: 0,
      },

      cancelledOrders: {
        type: Number,
        default: 0,
      },

      deliveryScore: {
        type: Number,
        default: null,
      },

      qualityScore: {
        type: Number,
        default: null,
      },

      fulfillmentScore: {
        type: Number,
        default: null,
      },

      priceScore: {
        type: Number,
        default: null,
      },

      responseTimeScore: {
        type: Number,
        default: null,
      },

      poAcceptanceScore: {
        type: Number,
        default: null,
      },

      documentationScore: {
        type: Number,
        default: null,
      },

      communicationScore: {
        type: Number,
        default: null,
      },

      overallRating: {
        type: Number,
        default: null,
      },

      ratingCategory: {
        type: String,
        enum: [
          "Preferred Vendor",
          "Excellent",
          "Good",
          "Average",
          "Poor",
          null,
        ],
        default: null,
      },

      lastEvaluatedAt: {
        type: Date,
        default: null,
      },
    },

    // ===============================
    // Audit
    // ===============================
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

export default mongoose.model("Vendor", vendorSchema);