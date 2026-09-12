import mongoose from "mongoose";
import Payment from "../models/Payment.js";
import Invoice from "../models/Invoice.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import GoodsReceipt from "../models/GoodsReceipt.js";
import QualityInspection from "../models/QualityInspection.js";
import ReplacementRequest from "../models/ReplacementRequest.js";
import Vendor from "../models/Vendor.js";
import Material from "../models/Material.js";
import User from "../models/User.js";

/**
 * =========================================================
 * Helper: Generate Payment Sequence Number
 * Format: PAY-YYYY-XXXXXX (e.g. PAY-2026-000001)
 * =========================================================
 */
export const generatePaymentNumber = async () => {
  const currentYear = new Date().getFullYear();
  const prefix = `PAY-${currentYear}-`;

  const lastPayment = await Payment.findOne({
    paymentNumber: { $regex: `^${prefix}` },
  })
    .sort({ createdAt: -1 })
    .select("paymentNumber");

  if (!lastPayment) {
    return `${prefix}000001`;
  }

  const lastSequence =
    parseInt(lastPayment.paymentNumber.replace(prefix, ""), 10) || 0;

  const nextSequence = String(lastSequence + 1).padStart(6, "0");
  return `${prefix}${nextSequence}`;
};

/**
 * =========================================================
 * Helper: 4-Way Quantity Reconciliation Builder
 * (PO Ordered → GRN Received → QA Accepted/Rejected → Replacement Accepted → Invoiced)
 * =========================================================
 */
export const buildQuantityReconciliation = async (purchaseOrderId, invoice) => {
  const po = await PurchaseOrder.findById(purchaseOrderId);
  if (!po) return [];

  // Fetch GRNs
  const grns = await GoodsReceipt.find({
    purchaseOrder: purchaseOrderId,
    isDeleted: false,
    status: { $ne: "Cancelled" },
  }).select("items");

  // Fetch Quality Inspections
  const inspections = await QualityInspection.find({
    purchaseOrder: purchaseOrderId,
    isDeleted: false,
    status: { $nin: ["Draft", "Cancelled"] },
  }).select("items");

  // Fetch Replacements
  const replacements = await ReplacementRequest.find({
    purchaseOrder: purchaseOrderId,
    isDeleted: false,
  }).select("items");

  // Build maps per material
  const grnReceivedMap = {};
  for (const grn of grns) {
    for (const item of grn.items || []) {
      const mId = String(item.material);
      grnReceivedMap[mId] = (grnReceivedMap[mId] || 0) + Number(item.receivedQuantity || 0);
    }
  }

  const qaAcceptedMap = {};
  const qaRejectedMap = {};
  for (const qi of inspections) {
    for (const item of qi.items || []) {
      const mId = String(item.material);
      qaAcceptedMap[mId] = (qaAcceptedMap[mId] || 0) + Number(item.acceptedQuantity || 0);
      qaRejectedMap[mId] = (qaRejectedMap[mId] || 0) + Number(item.rejectedQuantity || 0);
    }
  }

  const repRequestedMap = {};
  const repDispatchedMap = {};
  const repAcceptedMap = {};
  for (const rep of replacements) {
    for (const item of rep.items || []) {
      const mId = String(item.material);
      repRequestedMap[mId] = (repRequestedMap[mId] || 0) + Number(item.replacementQuantity || 0);
      repDispatchedMap[mId] = (repDispatchedMap[mId] || 0) + Number(item.replacementDispatchedQuantity || 0);
      repAcceptedMap[mId] = (repAcceptedMap[mId] || 0) + Number(item.replacementAcceptedQuantity || 0);
    }
  }

  const reconciliation = (invoice.items || []).map((invItem) => {
    const matId = String(invItem.material?._id || invItem.material);
    const ordered = Number(invItem.orderedQuantity || 0);
    const received = grnReceivedMap[matId] !== undefined ? grnReceivedMap[matId] : Number(invItem.receivedQuantity || 0);
    const originalAccepted = qaAcceptedMap[matId] !== undefined ? qaAcceptedMap[matId] : Number(invItem.acceptedQuantity || 0);
    const originalRejected = qaRejectedMap[matId] || 0;
    const repRequested = repRequestedMap[matId] || 0;
    const repDispatched = repDispatchedMap[matId] || 0;
    const repAccepted = repAcceptedMap[matId] || 0;

    // Final accepted = original accepted + replacement accepted
    const finalAccepted = originalAccepted + repAccepted;
    const invoicedQty = Number(invItem.invoicedQuantity || 0);

    return {
      material: invItem.material?._id || invItem.material,
      materialCode: invItem.materialCode,
      materialName: invItem.materialName,
      unitOfMeasure: invItem.unitOfMeasure,
      orderedQuantity: ordered,
      originalReceivedQuantity: received,
      originalRejectedQuantity: originalRejected,
      originalAcceptedQuantity: originalAccepted,
      replacementRequestedQuantity: repRequested,
      replacementDispatchedQuantity: repDispatched,
      replacementAcceptedQuantity: repAccepted,
      finalAcceptedQuantity: finalAccepted,
      invoicedQuantity: invoicedQty,
      paidQuantity: invoicedQty,
      unitPrice: Number(invItem.unitPrice || 0),
      lineTotal: Number(invItem.lineTotal || 0),
    };
  });

  return reconciliation;
};

/**
 * =========================================================
 * 1. Get Payment Queue (Approved Invoices ready for disbursement)
 * =========================================================
 */
export const getPaymentQueue = async (
  {
    page = 1,
    limit = 10,
    search = "",
    vendorId = "",
  } = {},
  user
) => {
  const query = {
    isDeleted: false,
    status: { $in: ["Approved", "Payment Processing"] },
    "payment.outstandingAmount": { $gt: 0 },
  };

  if (user && user.role === "VENDOR") {
    query.vendor = user.vendor;
  } else if (vendorId) {
    query.vendor = vendorId;
  }

  if (search) {
    query.$or = [
      { invoiceNumber: { $regex: search, $options: "i" } },
      { vendorRemarks: { $regex: search, $options: "i" } },
    ];
  }

  const total = await Invoice.countDocuments(query);

  const invoices = await Invoice.find(query)
    .populate("vendor", "vendorCode vendorName email mobile bankDetails")
    .populate("purchaseOrder", "poNumber orderDate expectedDeliveryDate grandTotal currency paymentTerms")
    .populate("approval.approvedBy", "name email")
    .sort({ dueDate: 1, createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  return {
    queue: invoices,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)) || 1,
  };
};

/**
 * =========================================================
 * 2. Process Payment (Record Disbursement)
 * =========================================================
 */
export const processPayment = async (data, userId) => {
  const {
    invoiceId,
    amount,
    paymentMethod = "NEFT",
    transactionReference = "",
    paymentDate = new Date(),
    notes = "",
    documents = [],
  } = data;

  if (!invoiceId) {
    throw new Error("Invoice ID is required.");
  }

  const invoice = await Invoice.findOne({ _id: invoiceId, isDeleted: false })
    .populate("vendor", "vendorCode vendorName bankDetails")
    .populate("purchaseOrder", "poNumber grandTotal");

  if (!invoice) {
    throw new Error("Invoice not found.");
  }

  // Payment Eligibility check
  if (!["Approved", "Payment Processing"].includes(invoice.status)) {
    throw new Error(`Payments cannot be disbursed against an invoice in "${invoice.status}" status.`);
  }

  const roundCurrency = (val) => Math.round((Number(val) || 0) * 100) / 100;

  const rawOutstanding =
    invoice.payment?.outstandingAmount !== undefined
      ? invoice.payment.outstandingAmount
      : invoice.totalAmount;

  const outstanding = roundCurrency(rawOutstanding);
  const paymentAmount = roundCurrency(amount);

  if (paymentAmount <= 0) {
    throw new Error("Payment amount must be greater than 0.");
  }

  if (paymentAmount > outstanding + 0.01) {
    throw new Error(
      `Payment amount (₹${paymentAmount.toFixed(2)}) cannot exceed the invoice outstanding balance (₹${outstanding.toFixed(2)}).`
    );
  }

  const paymentNumber = await generatePaymentNumber();

  // Snapshot bank details
  const vendorBank = invoice.vendor?.bankDetails || {};
  const bankDetailsSnapshot = {
    bankName: vendorBank.bankName || "",
    accountHolder: vendorBank.accountHolder || invoice.vendor?.vendorName || "",
    accountNumber: vendorBank.accountNumber || "",
    ifscCode: vendorBank.ifscCode || "",
    branch: vendorBank.branch || "",
  };

  // Build 4-Way Quantity Reconciliation
  const reconciliation = await buildQuantityReconciliation(
    invoice.purchaseOrder?._id || invoice.purchaseOrder,
    invoice
  );

  const prevPaid = roundCurrency(invoice.payment?.paidAmount || 0);
  const newTotalPaid = roundCurrency(prevPaid + paymentAmount);
  let remainingBalance = Math.max(0, roundCurrency(Number(invoice.totalAmount || 0) - newTotalPaid));
  if (remainingBalance < 0.01) remainingBalance = 0;

  const isFullyPaid = remainingBalance <= 0;
  const resultingPaymentStatus = isFullyPaid ? "Paid" : "Partially Paid";

  // Create Payment Record
  const payment = await Payment.create({
    paymentNumber,
    invoice: invoice._id,
    purchaseOrder: invoice.purchaseOrder?._id || invoice.purchaseOrder,
    vendor: invoice.vendor?._id || invoice.vendor,
    paymentDate: new Date(paymentDate),
    amount: paymentAmount,
    currency: invoice.currency || "INR",
    paymentMethod,
    transactionReference: transactionReference.trim(),
    status: "Completed",
    bankDetails: bankDetailsSnapshot,
    invoiceSnapshot: {
      invoiceNumber: invoice.invoiceNumber,
      invoiceTotalAmount: roundCurrency(invoice.totalAmount),
      previouslyPaidAmount: prevPaid,
      currentPaymentAmount: paymentAmount,
      remainingBalanceAfterPayment: remainingBalance,
      paymentStatusAfterThisPayment: resultingPaymentStatus,
    },
    quantityReconciliation: reconciliation,
    documents: documents || [],
    notes: notes.trim(),
    processedBy: userId,
    createdBy: userId,
  });

  // Update Invoice Document
  invoice.payment = {
    paymentStatus: resultingPaymentStatus,
    paidAmount: newTotalPaid,
    outstandingAmount: remainingBalance,
    paymentDate: new Date(paymentDate),
    paymentReference: transactionReference.trim() || invoice.payment?.paymentReference || "",
    paymentMethod,
    paymentRemarks: notes.trim() || invoice.payment?.paymentRemarks || "",
    paidBy: userId,
  };

  invoice.status = isFullyPaid ? "Paid" : "Payment Processing";
  invoice.updatedBy = userId;
  await invoice.save();

  return await getPaymentById(payment._id);
};

/**
 * =========================================================
 * 3. Get All Payments (Listing & History)
 * =========================================================
 */
export const getAllPayments = async (
  {
    page = 1,
    limit = 10,
    search = "",
    status = "",
    vendorId = "",
    invoiceId = "",
    paymentMethod = "",
    fromDate = "",
    toDate = "",
  } = {},
  user
) => {
  const query = { isDeleted: false };

  if (user && user.role === "VENDOR") {
    if (!user.vendor) {
      throw new Error("Vendor user is not associated with a vendor profile.");
    }
    query.vendor = user.vendor;
  } else if (vendorId) {
    query.vendor = vendorId;
  }

  if (invoiceId) {
    query.invoice = invoiceId;
  }

  if (status) {
    query.status = status;
  }

  if (paymentMethod) {
    query.paymentMethod = paymentMethod;
  }

  if (search) {
    query.$or = [
      { paymentNumber: { $regex: search, $options: "i" } },
      { transactionReference: { $regex: search, $options: "i" } },
      { notes: { $regex: search, $options: "i" } },
    ];
  }

  if (fromDate || toDate) {
    query.paymentDate = {};
    if (fromDate) {
      const fDate = new Date(fromDate);
      fDate.setHours(0, 0, 0, 0);
      query.paymentDate.$gte = fDate;
    }
    if (toDate) {
      const tDate = new Date(toDate);
      tDate.setHours(23, 59, 59, 999);
      query.paymentDate.$lte = tDate;
    }
  }

  const total = await Payment.countDocuments(query);

  const payments = await Payment.find(query)
    .populate("vendor", "vendorCode vendorName email mobile")
    .populate("invoice", "invoiceNumber invoiceDate dueDate totalAmount payment status")
    .populate("purchaseOrder", "poNumber orderDate grandTotal status")
    .populate("processedBy", "name email")
    .populate("createdBy", "name email")
    .sort({ paymentDate: -1, createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  return {
    payments,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)) || 1,
  };
};

/**
 * =========================================================
 * 4. Get Payment By ID
 * =========================================================
 */
export const getPaymentById = async (id, user) => {
  const payment = await Payment.findOne({ _id: id, isDeleted: false })
    .populate("vendor", "vendorCode vendorName email mobile gstNumber panNumber address bankDetails")
    .populate("invoice", "invoiceNumber invoiceDate dueDate subtotal taxAmount totalAmount payment status items")
    .populate("purchaseOrder", "poNumber orderDate expectedDeliveryDate grandTotal currency paymentTerms items")
    .populate("quantityReconciliation.material", "materialCode materialName unitOfMeasure standardCost")
    .populate("processedBy", "name email role")
    .populate("createdBy", "name email role");

  if (!payment) {
    throw new Error("Payment record not found.");
  }

  if (user && user.role === "VENDOR") {
    if (String(payment.vendor?._id || payment.vendor) !== String(user.vendor)) {
      throw new Error("Unauthorized.");
    }
  }

  return payment;
};

/**
 * =========================================================
 * 5. Get Payment Dashboard Analytics
 * =========================================================
 */
export const getPaymentDashboardStats = async (user) => {
  const match = { isDeleted: false };
  const invoiceMatch = { isDeleted: false };

  if (user && user.role === "VENDOR") {
    if (!user.vendor) {
      throw new Error("Vendor user is not associated with a vendor profile.");
    }
    match.vendor = new mongoose.Types.ObjectId(user.vendor);
    invoiceMatch.vendor = new mongoose.Types.ObjectId(user.vendor);
  }

  // Payments aggregates
  const completedPayments = await Payment.countDocuments({ ...match, status: "Completed" });
  const processingPayments = await Payment.countDocuments({ ...match, status: "Processing" });
  const failedPayments = await Payment.countDocuments({ ...match, status: "Failed" });

  const paymentTotals = await Payment.aggregate([
    { $match: { ...match, status: "Completed" } },
    {
      $group: {
        _id: null,
        totalPaidAmount: { $sum: "$amount" },
      },
    },
  ]);

  // Invoice payables aggregates
  const now = new Date();
  const queueInvoicesCount = await Invoice.countDocuments({
    ...invoiceMatch,
    status: { $in: ["Approved", "Payment Processing"] },
    "payment.outstandingAmount": { $gt: 0 },
  });

  const overdueInvoicesCount = await Invoice.countDocuments({
    ...invoiceMatch,
    status: { $in: ["Approved", "Payment Processing"] },
    "payment.outstandingAmount": { $gt: 0 },
    dueDate: { $lt: now },
  });

  const invoiceTotals = await Invoice.aggregate([
    { $match: invoiceMatch },
    {
      $group: {
        _id: null,
        totalInvoicedAmount: { $sum: "$totalAmount" },
        totalPaidAmount: { $sum: "$payment.paidAmount" },
        totalOutstandingAmount: { $sum: "$payment.outstandingAmount" },
      },
    },
  ]);

  return {
    totalPayablesAmount: invoiceTotals[0]?.totalInvoicedAmount || 0,
    totalPaidAmount: paymentTotals[0]?.totalPaidAmount || invoiceTotals[0]?.totalPaidAmount || 0,
    totalOutstandingAmount: invoiceTotals[0]?.totalOutstandingAmount || 0,
    queueCount: queueInvoicesCount,
    overdueCount: overdueInvoicesCount,
    completedCount: completedPayments,
    processingCount: processingPayments,
    failedCount: failedPayments,
  };
};

/**
 * =========================================================
 * 6. Update Payment Status (Exception handling: Failed / Cancelled)
 * =========================================================
 */
export const updatePaymentStatus = async (id, { status, failureReason = "" }, userId) => {
  const payment = await Payment.findOne({ _id: id, isDeleted: false });
  if (!payment) throw new Error("Payment record not found.");

  payment.status = status;
  if (failureReason) payment.failureReason = failureReason;
  payment.updatedBy = userId;
  await payment.save();

  // If failed or cancelled, adjust the invoice outstanding balance back
  if (["Failed", "Cancelled"].includes(status)) {
    const invoice = await Invoice.findById(payment.invoice);
    if (invoice) {
      const newPaid = Math.max(0, (invoice.payment?.paidAmount || 0) - payment.amount);
      const newOutstanding = invoice.totalAmount - newPaid;
      invoice.payment.paidAmount = newPaid;
      invoice.payment.outstandingAmount = newOutstanding;
      invoice.payment.paymentStatus = newPaid === 0 ? "Unpaid" : "Partially Paid";
      invoice.status = "Approved"; // Re-open for disbursement
      invoice.updatedBy = userId;
      await invoice.save();
    }
  }

  return await getPaymentById(payment._id);
};

const paymentService = {
  generatePaymentNumber,
  buildQuantityReconciliation,
  getPaymentQueue,
  processPayment,
  getAllPayments,
  getPaymentById,
  getPaymentDashboardStats,
  updatePaymentStatus,
};

export default paymentService;

