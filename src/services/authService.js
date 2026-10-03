import crypto from "crypto";
import User from "../models/User.js";
import PasswordReset from "../models/PasswordReset.js";
import generateToken from "../utils/generateToken.js";
import { sendEmail } from "./emailService.js";

export const registerUser = async (userData) => {
  const { name, email, password, role } = userData;

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new Error("User already exists");
  }

  // Check if this is the very first user in the system (initial bootstrap)
  const totalUsers = await User.countDocuments();
  let assignedRole = "VIEWER";

  if (totalUsers === 0) {
    // Initial system setup: first user is SUPER_ADMIN
    assignedRole = "SUPER_ADMIN";
  } else if (role && role !== "VIEWER") {
    throw new Error(
      "Privileged roles cannot be self-assigned. Please contact an administrator."
    );
  }

  const user = await User.create({
    name,
    email,
    password,
    role: assignedRole,
  });

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    token: generateToken(user._id, user.role),
  };
};

export const loginUser = async (email, password) => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new Error("Invalid email or password");
  }

  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    throw new Error("Invalid email or password");
  }

  if (user.role === "VENDOR") {
    throw new Error(
      "Access denied. Vendor accounts must log in via the Vendor Portal."
    );
  }

  if (user.status && user.status !== "ACTIVE") {
    throw new Error(
      "Your account is inactive. Please contact the administrator."
    );
  }

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    token: generateToken(user._id, user.role),
  };
};

export const changeUserPassword = async (
  userId,
  currentPassword,
  newPassword
) => {
  if (!currentPassword || !newPassword) {
    throw new Error("Current password and new password are required.");
  }

  if (newPassword.length < 6) {
    throw new Error("New password must be at least 6 characters.");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found.");
  }

  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) {
    throw new Error("Incorrect current password.");
  }

  user.password = newPassword;
  await user.save();

  return {
    success: true,
    message: "Password changed successfully.",
  };
};

/**
 * ===========================================
 * Helper: Hash OTP using SHA-256
 * ===========================================
 */
const hashOtp = (otp) => {
  return crypto.createHash("sha256").update(String(otp).trim()).digest("hex");
};

/**
 * ===========================================
 * Request Password Reset OTP
 * ===========================================
 */
export const requestPasswordResetOtp = async (email, portal = null) => {
  if (!email || typeof email !== "string" || !email.includes("@")) {
    throw new Error("A valid email address is required.");
  }

  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({
    email: normalizedEmail,
    isDeleted: { $ne: true },
  });

  if (!user) {
    throw new Error("No account found with this email address.");
  }

  if (user.status && user.status !== "ACTIVE") {
    throw new Error(
      "This account is currently inactive. Please contact your system administrator."
    );
  }

  // Portal role isolation check
  if (portal === "vendor") {
    if (user.role !== "VENDOR") {
      throw new Error(
        "This email is not registered as a Vendor account. Please use the Staff Login portal."
      );
    }
    if (!user.vendor) {
      throw new Error("Vendor profile not found for this account.");
    }
  } else if (portal === "staff" || portal === "admin") {
    if (user.role === "VENDOR") {
      throw new Error(
        "This is a Vendor account. Please use the Vendor Portal to reset your password."
      );
    }
  }

  // Rate Limiting: 60-second cooldown between OTP requests for the same email
  const recentReset = await PasswordReset.findOne({
    email: normalizedEmail,
    createdAt: { $gt: new Date(Date.now() - 60 * 1000) },
  });

  if (recentReset) {
    throw new Error(
      "An OTP was recently sent. Please wait at least 60 seconds before requesting a new one."
    );
  }

  // Generate cryptographically secure 6-digit numeric OTP
  const otp = crypto.randomInt(100000, 1000000).toString();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

  // Clean up any existing tokens for this email and record the new one
  await PasswordReset.deleteMany({ email: normalizedEmail });
  await PasswordReset.create({
    email: normalizedEmail,
    otpHash,
    expiresAt,
    attempts: 0,
  });

  // Compose clean HTML and text email
  const emailSubject = "Password Reset OTP - Vendor Rating Mechanism";
  const emailText = `Hello ${user.name},\n\nYour password reset OTP is: ${otp}\n\nThis OTP is valid for 10 minutes.\n\nIf you did not request a password reset, please ignore this email.\n\nRegards,\nVendor Rating Mechanism`;

  const emailHtml = `
    <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; padding: 24px;">
      <div style="background-color: #2563eb; color: #ffffff; padding: 18px 24px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="margin: 0; font-size: 20px; font-weight: 700;">Vendor Rating Mechanism</h2>
        <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Password Reset Verification</p>
      </div>
      <p style="font-size: 15px; margin-bottom: 8px;">Hello <strong>${user.name}</strong>,</p>
      <div style="background-color: #f1f5f9; border-left: 4px solid #2563eb; padding: 10px 14px; margin: 14px 0 18px 0; font-size: 13px; color: #1e293b; border-radius: 0 6px 6px 0;">
        <strong>Password reset requested for account:</strong> <span style="color: #2563eb; font-weight: 600;">${normalizedEmail}</span>
      </div>
      <p style="font-size: 14px; color: #475569; margin-bottom: 20px;">Use the following 6-digit One-Time Password (OTP) to complete your verification:</p>
      <div style="background-color: #f8fafc; border: 1.5px dashed #94a3b8; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0;">
        <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #1e40af; font-family: monospace;">${otp}</span>
      </div>
      <p style="font-size: 13px; color: #64748b; margin-bottom: 8px;">⏳ This OTP is valid for <strong>10 minutes</strong> only for <strong>${normalizedEmail}</strong>. Never share this code with anyone.</p>
      <p style="font-size: 12px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px;">If you did not initiate this request, you can safely ignore this email.</p>
    </div>
  `;

  await sendEmail({
    to: normalizedEmail,
    subject: emailSubject,
    text: emailText,
    html: emailHtml,
  });

  return {
    success: true,
    message: "Password reset OTP has been sent to your email.",
  };
};

/**
 * ===========================================
 * Reset User Password With OTP
 * ===========================================
 */
export const resetUserPasswordWithOtp = async ({
  email,
  otp,
  newPassword,
  portal = null,
}) => {
  if (!email || !otp || !newPassword) {
    throw new Error("Email, OTP, and new password are required.");
  }

  if (typeof newPassword !== "string" || newPassword.length < 6) {
    throw new Error("New password must be at least 6 characters long.");
  }

  const normalizedEmail = email.trim().toLowerCase();

  const resetRecord = await PasswordReset.findOne({
    email: normalizedEmail,
    expiresAt: { $gt: new Date() },
  });

  if (!resetRecord) {
    throw new Error(
      "Invalid or expired OTP. Please request a new password reset OTP."
    );
  }

  // Brute-force protection: invalidate after 5 failed attempts
  if (resetRecord.attempts >= 5) {
    await PasswordReset.deleteOne({ _id: resetRecord._id });
    throw new Error(
      "Too many failed attempts. This OTP has been invalidated for security. Please request a new one."
    );
  }

  const enteredHash = hashOtp(otp);

  if (enteredHash !== resetRecord.otpHash) {
    resetRecord.attempts += 1;
    await resetRecord.save();
    const remaining = 5 - resetRecord.attempts;
    throw new Error(
      `Invalid OTP code. ${
        remaining > 0
          ? `${remaining} attempt(s) remaining.`
          : "Maximum attempts reached. Please request a new OTP."
      }`
    );
  }

  const user = await User.findOne({
    email: normalizedEmail,
    isDeleted: { $ne: true },
  });

  if (!user) {
    throw new Error("User account not found.");
  }

  // Portal role isolation check
  if (portal === "vendor") {
    if (user.role !== "VENDOR") {
      throw new Error(
        "This email is not registered as a Vendor account. Please use the Staff Login portal."
      );
    }
  } else if (portal === "staff" || portal === "admin") {
    if (user.role === "VENDOR") {
      throw new Error(
        "This is a Vendor account. Please use the Vendor Portal to reset your password."
      );
    }
  }

  // Assign new password. The pre("save") hook will automatically salt and hash it.
  user.password = newPassword;
  await user.save();

  // Invalidate the reset token permanently
  await PasswordReset.deleteOne({ _id: resetRecord._id });

  return {
    success: true,
    message: "Password has been successfully updated. You can now log in.",
  };
};
