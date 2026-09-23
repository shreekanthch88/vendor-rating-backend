import invoiceService from "../services/invoiceService.js";

/**
 * =========================================================
 * Invoice Controller
 * =========================================================
 */

// 1. Get Dashboard Stats
export const getInvoiceDashboard = async (req, res, next) => {
  try {
    const stats = await invoiceService.getInvoiceDashboardStats(req.user);
    res.status(200).json({
      success: true,
      message: "Invoice dashboard statistics fetched successfully.",
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get Eligible POs for Invoicing
export const getEligiblePurchaseOrders = async (req, res, next) => {
  try {
    const vendorId = req.user.role === "VENDOR" ? req.user.vendor : req.query.vendorId;
    const eligiblePOs = await invoiceService.getEligiblePurchaseOrders(vendorId);
    res.status(200).json({
      success: true,
      message: "Eligible Purchase Orders fetched successfully.",
      data: eligiblePOs,
    });
  } catch (error) {
    next(error);
  }
};

// 3. Get PO Invoiceable Details
export const getPOInvoiceableDetails = async (req, res, next) => {
  try {
    const { purchaseOrderId } = req.params;
    const details = await invoiceService.calculatePOInvoiceableDetails(purchaseOrderId);
    res.status(200).json({
      success: true,
      message: "Purchase Order invoiceable details calculated successfully.",
      data: details,
    });
  } catch (error) {
    next(error);
  }
};

// 4. Create Invoice
export const createInvoice = async (req, res, next) => {
  try {
    const isVendor = req.user.role === "VENDOR";
    const invoice = await invoiceService.createInvoice(
      req.body,
      req.user._id,
      isVendor,
      req.user
    );
    res.status(201).json({
      success: true,
      message: "Invoice created successfully.",
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

// 5. Get All Invoices (Paginated & Filtered)
export const getAllInvoices = async (req, res, next) => {
  try {
    const result = await invoiceService.getAllInvoices(req.query, req.user);
    res.status(200).json({
      success: true,
      message: "Invoices fetched successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 6. Get Invoice by ID
export const getInvoiceById = async (req, res, next) => {
  try {
    const invoice = await invoiceService.getInvoiceById(req.params.id, req.user);
    res.status(200).json({
      success: true,
      message: "Invoice fetched successfully.",
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

// 7. Update Invoice
export const updateInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.updateInvoice(req.params.id, req.body, req.user);
    res.status(200).json({
      success: true,
      message: "Invoice updated successfully.",
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

// 8. Submit Invoice
export const submitInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.submitInvoice(req.params.id, req.user);
    res.status(200).json({
      success: true,
      message: "Invoice submitted successfully.",
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

// 9. Verify Invoice (Admin/Finance)
export const verifyInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.verifyInvoice(req.params.id, req.body, req.user._id);
    res.status(200).json({
      success: true,
      message: "Invoice verified successfully.",
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

// 10. Approve Invoice (Admin/Finance)
export const approveInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.approveInvoice(req.params.id, req.body, req.user._id);
    res.status(200).json({
      success: true,
      message: "Invoice approved successfully.",
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

// 11. Reject Invoice (Admin/Finance)
export const rejectInvoice = async (req, res, next) => {
  try {
    const { rejectionReason } = req.body;
    const invoice = await invoiceService.rejectInvoice(req.params.id, rejectionReason, req.user._id);
    res.status(200).json({
      success: true,
      message: "Invoice rejected.",
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

// 12. Dispute Invoice (Admin/Finance)
export const disputeInvoice = async (req, res, next) => {
  try {
    const { disputeReason } = req.body;
    const invoice = await invoiceService.disputeInvoice(req.params.id, disputeReason, req.user._id);
    res.status(200).json({
      success: true,
      message: "Invoice marked as disputed.",
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

// 13. Record Payment (Admin/Finance)
export const recordPayment = async (req, res, next) => {
  try {
    const invoice = await invoiceService.recordInvoicePayment(req.params.id, req.body, req.user._id);
    res.status(200).json({
      success: true,
      message: "Payment recorded successfully.",
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
};

// 14. Delete Invoice
export const deleteInvoice = async (req, res, next) => {
  try {
    const result = await invoiceService.deleteInvoice(req.params.id, req.user._id);
    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    next(error);
  }
};

const invoiceController = {
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
};

export default invoiceController;

