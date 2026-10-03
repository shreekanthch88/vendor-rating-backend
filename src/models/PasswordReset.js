import mongoose from "mongoose";

const passwordResetSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // SHA-256 hash of the 6-digit OTP
    otpHash: {
      type: String,
      required: true,
    },
    // Automatic TTL expiration by MongoDB
    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
    },
    // Brute-force protection: track failed verification attempts
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Create compound index for fast lookups
passwordResetSchema.index({ email: 1, createdAt: -1 });

export default mongoose.model("PasswordReset", passwordResetSchema);
