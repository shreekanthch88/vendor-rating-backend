import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Vendor from "../models/Vendor.js";

/**
 * ============================================
 * Generate Vendor JWT
 * ============================================
 */
const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

/**
 * ============================================
 * Vendor Login
 * ============================================
 */
export const vendorLogin = async (
  email,
  password
) => {

  if (!email || !password) {
    throw new Error(
      "Email and Password are required."
    );
  }

  const user = await User.findOne({
    email: email.toLowerCase(),
  }).populate("vendor");

  if (!user) {
    throw new Error(
      "Invalid email or password."
    );
  }

  const isMatch =
    await user.matchPassword(password);

  if (!isMatch) {
    throw new Error(
      "Invalid email or password."
    );
  }

  /**
 * ============================================
 * Validate Vendor Role
 * ============================================
 */
if (user.role !== "VENDOR") {
  throw new Error(
    "Access denied. Vendor account required."
  );
}

/**
 * ============================================
 * Validate User Status
 * ============================================
 */
if (user.status !== "ACTIVE") {
  throw new Error(
    "Your account is inactive. Please contact the administrator."
  );
}

/**
 * ============================================
 * Validate Vendor Profile
 * ============================================
 */
if (!user.vendor) {
  throw new Error(
    "Vendor profile not found."
  );
}

if (
  user.vendor.isDeleted ||
  user.vendor.status === "Blacklisted"
) {
  throw new Error(
    "Vendor account is not allowed to login."
  );
}

/**
 * ============================================
 * Update Last Login
 * ============================================
 */
user.lastLogin = new Date();
await user.save();

/**
 * ============================================
 * Return Login Response
 * ============================================
 */
return {
  success: true,
  message: "Vendor login successful.",
  token: generateToken(user._id),

  user: {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    lastLogin: user.lastLogin,
  },

  vendor: {
    _id: user.vendor._id,
    vendorCode: user.vendor.vendorCode,
    vendorName: user.vendor.vendorName,
    vendorCategory: user.vendor.vendorCategory,
    status: user.vendor.status,
  },
};
};