import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    // ===========================================
    // Basic Information
    // ===========================================
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    // ===========================================
    // Role
    // ===========================================
    role: {
      type: String,
      enum: [
        "SUPER_ADMIN",
        "ADMIN",
        "PURCHASE_MANAGER",
        "QUALITY_MANAGER",
        "FINANCE_MANAGER",
        "VIEWER",
        "VENDOR",
      ],
      default: "VIEWER",
    },

    // ===========================================
    // Vendor Information
    // (Only applicable for Vendor Users)
    // ===========================================
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
    },

    designation: {
      type: String,
      default: "",
      trim: true,
    },

    isPrimaryContact: {
      type: Boolean,
      default: false,
    },

    // ===========================================
    // Contact
    // ===========================================
    phone: {
      type: String,
      default: "",
      trim: true,
    },

    department: {
      type: String,
      default: "",
      trim: true,
    },

    // ===========================================
    // Status
    // ===========================================
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },

    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * ===========================================
 * Hash Password Before Save
 * ===========================================
 */
userSchema.pre("save", async function () {
  if (!this.isModified("password")) {
    return ;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

  
});

/**
 * ===========================================
 * Compare Password
 * ===========================================
 */
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("User", userSchema);