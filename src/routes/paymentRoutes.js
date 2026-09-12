import express from "express";
import {
  getPaymentDashboard,
  getPaymentQueue,
  processPayment,
  getAllPayments,
  getPaymentById,
  updatePaymentStatus,
} from "../controllers/paymentController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Protect all routes
router.use(protect);

/**
 * =========================================================
 * PAYMENT ROUTES
 * =========================================================
 */

// Dashboard
router.get("/dashboard", getPaymentDashboard);

// Payment Queue (Invoices awaiting disbursement)
router.get(
  "/queue",
  authorize("SUPER_ADMIN", "ADMIN", "FINANCE_MANAGER", "PURCHASE_MANAGER"),
  getPaymentQueue
);

// Process Payment (Disbursement Execution)
router.post(
  "/process",
  authorize("SUPER_ADMIN", "ADMIN", "FINANCE_MANAGER"),
  processPayment
);

// All Payments List & History
router.get("/", getAllPayments);

// Payment Details by ID
router.get("/:id", getPaymentById);

// Update Status (Failed / Cancelled)
router.patch(
  "/:id/status",
  authorize("SUPER_ADMIN", "ADMIN", "FINANCE_MANAGER"),
  updatePaymentStatus
);

export default router;

