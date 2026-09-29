import { protect, authorize } from "./authMiddleware.js";

/**
 * ==========================================
 * Vendor Authentication Middleware
 * ==========================================
 * Provides explicit guards for vendor-specific routes.
 */
export const vendorProtect = protect;
export const vendorAuthorize = authorize("VENDOR");

export default {
  vendorProtect,
  vendorAuthorize,
};

