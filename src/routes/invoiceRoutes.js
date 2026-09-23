import express from "express";
import {
  getInvoiceDashboard,
  getEligiblePurchaseOrders,
  getPOInvoiceableDetails,
  createInvoice,
  getAllInvoices,
  getInvoiceById,
  updateInvoice,
  submitInvoice,
  verifyInvoice,
  approveInvoice,
  rejectInvoice,
  disputeInvoice,
  recordPayment,
  deleteInvoice,
} from "../controllers/invoiceController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

/**
 * =========================================================
 * VENDOR & SHARED INVOICE ENDPOINTS
 * =========================================================
 */

// Eligible POs for invoicing
router.get("/eligible-pos", getEligiblePurchaseOrders);
router.get("/po-details/:purchaseOrderId", getPOInvoiceableDetails);

// Invoice Dashboard
router.get("/dashboard", getInvoiceDashboard);

// Standard CRUD
router.get("/", getAllInvoices);
router.get("/:id", getInvoiceById);
router.post(
  "/",
  authorize("SUPER_ADMIN", "ADMIN", "FINANCE_MANAGER", "PURCHASE_MANAGER", "VENDOR"),
  createInvoice
);
router.put(
  "/:id",
  authorize("SUPER_ADMIN", "ADMIN", "FINANCE_MANAGER", "PURCHASE_MANAGER", "VENDOR"),
  updateInvoice
);
router.patch(
  "/:id/submit",
  authorize("SUPER_ADMIN", "ADMIN", "FINANCE_MANAGER", "PURCHASE_MANAGER", "VENDOR"),
  submitInvoice
);

/**
 * =========================================================
 * ADMIN & FINANCE SPECIFIC ENDPOINTS
 * =========================================================
 */
router.patch(
  "/:id/verify",
  authorize("SUPER_ADMIN", "ADMIN", "FINANCE_MANAGER", "PURCHASE_MANAGER"),
  verifyInvoice
);

router.patch(
  "/:id/approve",
  authorize("SUPER_ADMIN", "ADMIN", "FINANCE_MANAGER", "PURCHASE_MANAGER"),
  approveInvoice
);

router.patch(
  "/:id/reject",
  authorize("SUPER_ADMIN", "ADMIN", "FINANCE_MANAGER", "PURCHASE_MANAGER"),
  rejectInvoice
);

router.patch(
  "/:id/dispute",
  authorize("SUPER_ADMIN", "ADMIN", "FINANCE_MANAGER", "PURCHASE_MANAGER"),
  disputeInvoice
);

router.patch(
  "/:id/payment",
  authorize("SUPER_ADMIN", "ADMIN", "FINANCE_MANAGER"),
  recordPayment
);

router.delete(
  "/:id",
  authorize("SUPER_ADMIN", "ADMIN", "FINANCE_MANAGER"),
  deleteInvoice
);

export default router;

