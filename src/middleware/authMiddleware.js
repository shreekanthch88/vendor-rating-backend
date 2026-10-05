import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Vendor from "../models/Vendor.js";

/**
 * ==========================================
 * Protect Routes
 * ==========================================
 *
 * Verifies JWT token and loads the logged-in
 * user into req.user.
 */
export const protect = async (req, res, next) => {
  try {
    let token;

    /**
     * ========================================
     * Check Authorization Header
     * ========================================
     */
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      /**
       * Extract token
       *
       * Authorization:
       * Bearer <token>
       */
      token =
        req.headers.authorization.split(" ")[1];

      /**
       * ======================================
       * Verify JWT
       * ======================================
       */
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );

      /**
       * ======================================
       * Find User
       * ======================================
       */
      req.user =
        await User.findById(decoded.id)
          .select("-password");

      /**
       * ======================================
       * User Not Found
       * ======================================
       */
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      /**
       * ======================================
       * Check User Active Status
       * ======================================
       */
      if (req.user.isDeleted || (req.user.status && req.user.status !== "ACTIVE")) {
        return res.status(401).json({
          success: false,
          message: "Your account is inactive. Please contact the administrator.",
        });
      }

      /**
       * ======================================
       * Check Vendor Active Status
       * ======================================
       */
      if (req.user.role === "VENDOR" && req.user.vendor) {
        const vendorDoc = await Vendor.findById(req.user.vendor).select("status isDeleted");
        if (!vendorDoc || vendorDoc.isDeleted || vendorDoc.status !== "Active") {
          return res.status(401).json({
            success: false,
            message: "Your vendor account is inactive. Please contact the administrator.",
          });
        }
      }

      /**
       * ======================================
       * DEBUG INFORMATION
       * ======================================
       *
       * Temporary logs to verify the
       * Vendor User -> Vendor relationship.
       *
       * We can remove these after testing.
       */
      console.log(
        "=========================================="
      );

      console.log(
        "AUTHENTICATED USER"
      );

      console.log(
        "User ID:",
        req.user._id
      );

      console.log(
        "User Name:",
        req.user.name
      );

      console.log(
        "User Email:",
        req.user.email
      );

      console.log(
        "User Role:",
        req.user.role
      );

      console.log(
        "Vendor ID:",
        req.user.vendor
      );

      console.log(
        "User Status:",
        req.user.status
      );

      console.log(
        "=========================================="
      );

      /**
       * ======================================
       * Continue
       * ======================================
       */
      next();

    } else {

      /**
       * No Authorization Header
       */
      return res.status(401).json({
        success: false,
        message:
          "Not authorized. No token provided.",
      });
    }

  } catch (error) {

    console.error(
      "=========================================="
    );

    console.error(
      "AUTH MIDDLEWARE ERROR"
    );

    console.error(
      error.message
    );

    console.error(
      "=========================================="
    );

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

/**
 * ==========================================
 * Authorize Roles
 * ==========================================
 *
 * Usage:
 *
 * authorize("SUPER_ADMIN")
 *
 * authorize(
 *   "SUPER_ADMIN",
 *   "ADMIN"
 * )
 */
export const authorize = (...roles) => {

  return (req, res, next) => {

    /**
     * Make sure user exists
     */
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Not authorized.",
      });
    }

    /**
     * Check Role
     */
    if (!roles.includes(req.user.role)) {

      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    /**
     * Role authorized
     */
    next();
  };
};