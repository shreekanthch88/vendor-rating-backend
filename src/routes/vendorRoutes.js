import express from "express";

import {
  createVendor,
  getAllVendors,
  getVendorById,
  updateVendor,
  updateVendorStatus,
  deleteVendor,
  getVendorDashboard,

  // Vendor Users
  createVendorUser,
  getVendorUsers,
  getVendorUserById,
  updateVendorUser,
  resetVendorUserPassword,
  changeVendorUserStatus,
  deleteVendorUser,
} from "../controllers/vendorController.js";

import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

import {
  vendorValidationRules,
  validate,
} from "../validators/vendorValidator.js";

const router = express.Router();

/**
 * =====================================================
 * Dashboard
 * =====================================================
 */

router.get(
  "/dashboard",
  protect,
  authorize(
    "SUPER_ADMIN",
    "ADMIN",
    "PURCHASE_MANAGER"
  ),
  getVendorDashboard
);

/**
 * =====================================================
 * Vendor CRUD
 * =====================================================
 */

router.get(
  "/",
  protect,
  authorize(
    "SUPER_ADMIN",
    "ADMIN",
    "PURCHASE_MANAGER",
    "QUALITY_MANAGER",
    "FINANCE_MANAGER",
    "VIEWER"
  ),
  getAllVendors
);

router.get(
  "/:id",
  protect,
  authorize(
    "SUPER_ADMIN",
    "ADMIN",
    "PURCHASE_MANAGER",
    "QUALITY_MANAGER",
    "FINANCE_MANAGER",
    "VIEWER"
  ),
  getVendorById
);

router.post(
  "/",
  protect,
  authorize(
    "SUPER_ADMIN",
    "ADMIN",
    "PURCHASE_MANAGER"
  ),
  vendorValidationRules,
  validate,
  createVendor
);

router.put(
  "/:id",
  protect,
  authorize(
    "SUPER_ADMIN",
    "ADMIN",
    "PURCHASE_MANAGER"
  ),
  vendorValidationRules,
  validate,
  updateVendor
);

router.patch(
  "/:id/status",
  protect,
  authorize(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  updateVendorStatus
);

router.delete(
  "/:id",
  protect,
  authorize("SUPER_ADMIN"),
  deleteVendor
);

/**
 * =====================================================
 * Vendor Users
 * =====================================================
 */

// Create Vendor User
router.post(
  "/:vendorId/users",
  protect,
  authorize(
    "SUPER_ADMIN",
    "ADMIN",
    "PURCHASE_MANAGER"
  ),
  createVendorUser
);

// Get All Vendor Users
router.get(
  "/:vendorId/users",
  protect,
  authorize(
    "SUPER_ADMIN",
    "ADMIN",
    "PURCHASE_MANAGER"
  ),
  getVendorUsers
);

// Get Vendor User By Id
router.get(
  "/:vendorId/users/:userId",
  protect,
  authorize(
    "SUPER_ADMIN",
    "ADMIN",
    "PURCHASE_MANAGER"
  ),
  getVendorUserById
);

// Update Vendor User
router.put(
  "/:vendorId/users/:userId",
  protect,
  authorize(
    "SUPER_ADMIN",
    "ADMIN",
    "PURCHASE_MANAGER"
  ),
  updateVendorUser
);

// Reset Password
router.patch(
  "/:vendorId/users/:userId/reset-password",
  protect,
  authorize(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  resetVendorUserPassword
);

// Activate / Deactivate
router.patch(
  "/:vendorId/users/:userId/status",
  protect,
  authorize(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  changeVendorUserStatus
);

// Delete Vendor User
router.delete(
  "/:vendorId/users/:userId",
  protect,
  authorize(
    "SUPER_ADMIN",
    "ADMIN"
  ),
  deleteVendorUser
);

export default router;