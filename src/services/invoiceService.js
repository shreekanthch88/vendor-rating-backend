import mongoose from "mongoose";
import Invoice from "../models/Invoice.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import GoodsReceipt from "../models/GoodsReceipt.js";
import QualityInspection from "../models/QualityInspection.js";
import ReInspection from "../models/ReInspection.js";
import ReplacementRequest from "../models/ReplacementRequest.js";
import Vendor from "../models/Vendor.js";
import Material from "../models/Material.js";
import User from "../models/User.js";

/**
 * =========================================================
 * Helper: Generate Invoice Number
 * Format: INV-YYYY-XXXXXX (e.g. INV-2026-000001)
 * =========================================================
 */
export const generateInvoiceNumber = async () => {
  const currentYear = new Date().getFullYear();
  const prefix = `INV-${currentYear}-`;

  const lastInvoice = await Invoice.findOne({
    invoiceNumber: { $regex: `^${prefix}` },
  })
    .sort({ createdAt: -1 })
    .select("invoiceNumber");

  if (!lastInvoice) {
    return `${prefix}000001`;
  }

  const lastSequence = parseInt(
    lastInvoice.invoiceNumber.replace(prefix, ""),
    10
  ) || 0;

  const nextSequence = String(lastSequence + 1).padStart(6, "0");
  return `${prefix}${nextSequence}`;
};

/**
 * =========================================================
 * Helper: Calculate Accepted / Invoiceable Quantities for a PO
 * 
 * Accurately reconciles:
 * 1. Partial Dispatches & Normal Deliveries (e.g., 70 + 30)
 * 2. Original Quality Inspections
 * 3. Original Re-Inspections (Recovered rejected stock)
 * 4. Replacement Deliveries & Re-Inspections (Fulfilling rejected stock)
 * 5. Prior Invoices (Multi-invoice support for partial shipments)
 * 
 * Maximum invoiceable quantity across all invoices CANNOT exceed PO ordered quantity.
 * =========================================================
 */
export const calculatePOInvoiceableDetails = async (purchaseOrderId) => {
  const po = await PurchaseOrder.findById(purchaseOrderId)
    .populate("vendor", "vendorCode vendorName email")
    .populate("items.material", "materialCode materialName unitOfMeasure standardCost");

  if (!po || po.isDeleted) {
    throw new Error("Purchase Order not found.");
  }

  // 1. Fetch Normal and Replacement GRNs
  const grns = await GoodsReceipt.find({
    purchaseOrder: purchaseOrderId,
    isDeleted: false,
    status: { $ne: "Cancelled" },
  }).select("_id grnNumber receiptDate status items receiptType");

  // 2. Fetch Original Quality Inspections
  const inspections = await QualityInspection.find({
    purchaseOrder: purchaseOrderId,
    isDeleted: false,
    status: { $nin: ["Draft", "Cancelled"] },
  }).select("_id inspectionNumber inspectionDate overallResult status items isReinspection originalInspection");

  // 3. Fetch Re-Inspections
  const reInspections = await ReInspection.find({
    purchaseOrder: purchaseOrderId,
    status: "Completed",
  }).select("_id reInspectionNumber reinspectionType items");

  // 4. Fetch Replacement Requests
  const replacements = await ReplacementRequest.find({
    purchaseOrder: purchaseOrderId,
    isDeleted: false,
    status: { $ne: "Cancelled" },
  }).select("_id requestNumber items status");

  // 5. Fetch prior active invoices for this PO
  const existingInvoices = await Invoice.find({
    purchaseOrder: purchaseOrderId,
    isDeleted: false,
    status: { $nin: ["Cancelled", "Rejected"] },
  }).select("items status invoiceNumber");

  // Map invoiced quantities per material
  const invoicedQtyMap = {};
  for (const inv of existingInvoices) {
    for (const item of inv.items || []) {
      const matId = String(item.material);
      invoicedQtyMap[matId] = (invoicedQtyMap[matId] || 0) + Number(item.invoicedQuantity || 0);
    }
  }

  // Map normal received quantities per material
  const receivedQtyMap = {};
  for (const grn of grns) {
    if (grn.receiptType !== "Replacement") {
      for (const item of grn.items || []) {
        const matId = String(item.material);
        receivedQtyMap[matId] = (receivedQtyMap[matId] || 0) + Number(item.receivedQuantity || 0);
      }
    }
  }

  // 1. Original Quality Inspections (Exclude re-inspections to avoid duplicate counting)
  const originalAcceptedQtyMap = {};
  for (const qi of inspections) {
    if (!qi.isReinspection && !qi.originalInspection) {
      for (const item of qi.items || []) {
        const matId = String(item.material);
        const accepted = Number(item.acceptedQuantity || 0);
        originalAcceptedQtyMap[matId] = (originalAcceptedQtyMap[matId] || 0) + accepted;
      }
    }
  }

  // 2. Original Re-Inspections (Material recovered from original rejected/damaged batch)
  const originalRecoveredQtyMap = {};
  for (const re of reInspections) {
    if (re.reinspectionType === "ORIGINAL_MATERIAL") {
      for (const item of re.items || []) {
        const matId = String(item.material);
        const accepted = Number(item.acceptedQuantity || 0);
        originalRecoveredQtyMap[matId] = (originalRecoveredQtyMap[matId] || 0) + accepted;
      }
    }
  }

  // 3. Replacement Accepted Quantities (From verified replacement shipments)
  const replacementAcceptedQtyMap = {};
  for (const rep of replacements) {
    for (const item of rep.items || []) {
      const matId = String(item.material);
      const repAccepted = Number(item.replacementAcceptedQuantity || 0);
      replacementAcceptedQtyMap[matId] = (replacementAcceptedQtyMap[matId] || 0) + repAccepted;
    }
  }

  // Calculate items breakdown
  const items = (po.items || []).map((poItem) => {
    const matId = String(poItem.material?._id || poItem.material);
    const ordered = Number(poItem.quantity || 0);
    const received = receivedQtyMap[matId] || 0;
    const origAccepted = originalAcceptedQtyMap[matId] || 0;
    const origRecovered = originalRecoveredQtyMap[matId] || 0;
    const repAccepted = replacementAcceptedQtyMap[matId] || 0;

    // Total accepted net fulfillment capped at ordered quantity
    const totalAccepted = Math.min(ordered, origAccepted + origRecovered + repAccepted);
    const alreadyInvoiced = invoicedQtyMap[matId] || 0;
    const availableToInvoice = Math.max(0, totalAccepted - alreadyInvoiced);

    return {
      material: poItem.material?._id || poItem.material,
      materialCode: poItem.materialCode,
      materialName: poItem.materialName,
      description: poItem.description || "",
      unitOfMeasure: poItem.unitOfMeasure,
      orderedQuantity: ordered,
      receivedQuantity: received,
      originalAcceptedQuantity: origAccepted,
      originalRecoveredQuantity: origRecovered,
      replacementAcceptedQuantity: repAccepted,
      acceptedQuantity: totalAccepted,
      alreadyInvoicedQuantity: alreadyInvoiced,
      availableToInvoiceQuantity: availableToInvoice,
      unitPrice: Number(poItem.unitPrice || 0),
      taxPercentage: Number(poItem.taxPercentage || 0),
      discountPercentage: Number(poItem.discountPercentage || 0),
    };
  });

  const totalAcceptedQty = items.reduce((sum, i) => sum + i.acceptedQuantity, 0);
  const totalAvailableToInvoiceQty = items.reduce((sum, i) => sum + i.availableToInvoiceQuantity, 0);
  const isEligible = totalAvailableToInvoiceQty > 0;

  return {
    purchaseOrder: po,
    items,
    goodsReceipts: grns.map((g) => g._id),
    qualityInspections: inspections.map((q) => q._id),
    totalAcceptedQty,
    totalAvailableToInvoiceQty,
    isEligible,
  };
};

/**
 * =========================================================
 * 1. Get Eligible Purchase Orders For Invoicing
 * =========================================================
 */
export const getEligiblePurchaseOrders = async (vendorId) => {
  const query = {
    isDeleted: false,
    status: {
      $in: [
        "Approved",
        "Sent",
        "Accepted",
        "Partially Delivered",
        "Delivered",
        "Closed",
        "Completed",
      ],
    },
  };

  if (vendorId) {
    query.vendor = vendorId;
  }

  const purchaseOrders = await PurchaseOrder.find(query)
    .populate("vendor", "vendorCode vendorName email paymentTerms")
    .sort({ createdAt: -1 });

  const eligibleList = [];

  for (const po of purchaseOrders) {
    try {
      const details = await calculatePOInvoiceableDetails(po._id);
      if (details.isEligible) {
        eligibleList.push({
          _id: po._id,
          poNumber: po.poNumber,
          orderDate: po.orderDate,
          expectedDeliveryDate: po.expectedDeliveryDate,
          status: po.status,
          currency: po.currency,
          paymentTerms: po.paymentTerms,
          vendor: po.vendor,
          grandTotal: po.grandTotal,
          items: details.items,
          goodsReceipts: details.goodsReceipts,
          qualityInspections: details.qualityInspections,
          totalAvailableToInvoiceQty: details.totalAvailableToInvoiceQty,
        });
      }
    } catch (err) {
      console.error(`Error calculating invoice eligibility for PO ${po.poNumber}:`, err);
    }
  }

  return eligibleList;
};

/**
 * =========================================================
 * 2. Create Invoice
 * =========================================================
 */
export const createInvoice = async (data, userId, isVendor = false) => {
  const {
    purchaseOrderId,
    vendorId,
    invoiceNumber: customInvoiceNumber,
    invoiceDate,
    dueDate,
    items: requestedItems,
    freightCharges = 0,
    vendorRemarks = "",
    documents = [],
    status = "Submitted",
  } = data;

  if (!purchaseOrderId) {
    throw new Error("Purchase Order ID is required.");
  }

  // Calculate allowable quantities & verify PO
  const poDetails = await calculatePOInvoiceableDetails(purchaseOrderId);
  const po = poDetails.purchaseOrder;

  const finalVendorId = isVendor
    ? String(po.vendor?._id || po.vendor)
    : (vendorId || String(po.vendor?._id || po.vendor));

  if (String(po.vendor?._id || po.vendor) !== String(finalVendorId)) {
    throw new Error("Vendor does not match the selected Purchase Order.");
  }

  if (!requestedItems || requestedItems.length === 0) {
    throw new Error("At least one material item is required to invoice.");
  }

  // Invoice Number
  let finalInvoiceNumber = customInvoiceNumber?.trim();
  if (!finalInvoiceNumber) {
    finalInvoiceNumber = await generateInvoiceNumber();
  } else {
    // Check uniqueness
    const existing = await Invoice.findOne({
      invoiceNumber: finalInvoiceNumber,
      isDeleted: false,
    });
    if (existing) {
      throw new Error(`Invoice number "${finalInvoiceNumber}" already exists.`);
    }
  }

  // Map po details item by material ID
  const poItemMap = {};
  for (const item of poDetails.items) {
    poItemMap[String(item.material)] = item;
  }

const roundCurrency = (val) => Math.round((Number(val) || 0) * 100) / 100;

  let subtotal = 0;
  let taxAmount = 0;
  let discountAmount = 0;

  const processedItems = [];

  for (const reqItem of requestedItems) {
    const matId = String(reqItem.material);
    const poItem = poItemMap[matId];

    if (!poItem) {
      throw new Error(`Material ${reqItem.materialCode || matId} is not in the Purchase Order.`);
    }

    const invoicedQty = Number(reqItem.invoicedQuantity || 0);

    if (invoicedQty <= 0) {
      continue; // Skip zero quantities
    }

    // Over-invoicing check
    if (invoicedQty > poItem.availableToInvoiceQuantity + 0.0001) {
      throw new Error(
        `Invoiced quantity (${invoicedQty}) for ${poItem.materialName} exceeds accepted & available quantity (${poItem.availableToInvoiceQuantity}).`
      );
    }

    // Unit Price enforcement (use PO price if not specified or enforce PO price)
    const unitPrice = roundCurrency(poItem.unitPrice);
    const discountPct = Number(reqItem.discountPercentage !== undefined ? reqItem.discountPercentage : poItem.discountPercentage || 0);
    const taxPct = Number(reqItem.taxPercentage !== undefined ? reqItem.taxPercentage : poItem.taxPercentage || 0);

    const gross = roundCurrency(invoicedQty * unitPrice);
    const itemDiscount = roundCurrency((gross * discountPct) / 100);
    const taxable = roundCurrency(gross - itemDiscount);
    const itemTax = roundCurrency((taxable * taxPct) / 100);
    const lineTotal = roundCurrency(taxable + itemTax);

    subtotal = roundCurrency(subtotal + gross);
    discountAmount = roundCurrency(discountAmount + itemDiscount);
    taxAmount = roundCurrency(taxAmount + itemTax);

    processedItems.push({
      material: poItem.material,
      materialCode: poItem.materialCode,
      materialName: poItem.materialName,
      description: poItem.description || "",
      unitOfMeasure: poItem.unitOfMeasure,
      orderedQuantity: poItem.orderedQuantity,
      receivedQuantity: poItem.receivedQuantity,
      acceptedQuantity: poItem.acceptedQuantity,
      invoicedQuantity: invoicedQty,
      unitPrice,
      taxPercentage: taxPct,
      taxAmount: itemTax,
      discountPercentage: discountPct,
      discountAmount: itemDiscount,
      lineTotal,
      remarks: reqItem.remarks || "",
    });
  }

  if (processedItems.length === 0) {
    throw new Error("Please specify a valid invoiced quantity greater than 0 for at least one item.");
  }

  const numFreight = roundCurrency(freightCharges || 0);
  const totalAmount = roundCurrency(subtotal - discountAmount + taxAmount + numFreight);

  // Calculate Due Date
  let finalDueDate = dueDate ? new Date(dueDate) : null;
  if (!finalDueDate || Number.isNaN(finalDueDate.getTime())) {
    const invDate = invoiceDate ? new Date(invoiceDate) : new Date();
    finalDueDate = new Date(invDate);
    finalDueDate.setDate(finalDueDate.getDate() + 30); // Default 30 days
  }

  const invoice = await Invoice.create({
    invoiceNumber: finalInvoiceNumber,
    vendor: finalVendorId,
    purchaseOrder: purchaseOrderId,
    goodsReceipts: poDetails.goodsReceipts,
    qualityInspections: poDetails.qualityInspections,
    invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
    dueDate: finalDueDate,
    currency: po.currency || "INR",
    paymentTerms: po.paymentTerms || "Net 30",
    items: processedItems,
    subtotal,
    taxAmount,
    discountAmount,
    freightCharges: numFreight,
    totalAmount,
    status: isVendor ? "Submitted" : (status || "Submitted"),
    verification: {
      isVerified: false,
    },
    approval: {},
    payment: {
      paymentStatus: "Unpaid",
      paidAmount: 0,
      outstandingAmount: totalAmount,
    },
    documents: documents || [],
    vendorRemarks,
    createdBy: userId,
  });

  return await getInvoiceById(invoice._id);
};

/**
 * =========================================================
 * 3. Get All Invoices (Multi-filter & Role-aware)
 * =========================================================
 */
export const getAllInvoices = async (
  {
    page = 1,
    limit = 10,
    search = "",
    status = "",
    paymentStatus = "",
    vendorId = "",
    purchaseOrderId = "",
    fromDate = "",
    toDate = "",
  } = {},
  user
) => {
  const query = { isDeleted: false };

  // Vendor role isolation
  if (user && user.role === "VENDOR") {
    if (!user.vendor) {
      throw new Error("Vendor user is not associated with a vendor profile.");
    }
    query.vendor = user.vendor;
  } else if (vendorId) {
    query.vendor = vendorId;
  }

  if (purchaseOrderId) {
    query.purchaseOrder = purchaseOrderId;
  }

  if (status) {
    query.status = status;
  }

  if (paymentStatus) {
    query["payment.paymentStatus"] = paymentStatus;
  }

  if (search) {
    query.$or = [
      { invoiceNumber: { $regex: search, $options: "i" } },
      { vendorRemarks: { $regex: search, $options: "i" } },
    ];
  }

  if (fromDate || toDate) {
    query.invoiceDate = {};
    if (fromDate) {
      const fDate = new Date(fromDate);
      fDate.setHours(0, 0, 0, 0);
      query.invoiceDate.$gte = fDate;
    }
    if (toDate) {
      const tDate = new Date(toDate);
      tDate.setHours(23, 59, 59, 999);
      query.invoiceDate.$lte = tDate;
    }
  }

  const total = await Invoice.countDocuments(query);

  const invoices = await Invoice.find(query)
    .populate("vendor", "vendorCode vendorName email mobile businessType")
    .populate("purchaseOrder", "poNumber orderDate expectedDeliveryDate grandTotal status paymentTerms")
    .populate("createdBy", "name email role")
    .populate("verification.verifiedBy", "name email")
    .populate("approval.approvedBy", "name email")
    .populate("approval.rejectedBy", "name email")
    .populate("payment.paidBy", "name email")
    .sort({ createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  return {
    invoices,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)) || 1,
  };
};

/**
 * =========================================================
 * 4. Get Invoice By ID
 * =========================================================
 */
export const getInvoiceById = async (id, user) => {
  const invoice = await Invoice.findOne({ _id: id, isDeleted: false })
    .populate("vendor", "vendorCode vendorName email mobile gstNumber panNumber address bankDetails paymentTerms")
    .populate("purchaseOrder", "poNumber orderDate expectedDeliveryDate grandTotal currency paymentTerms items")
    .populate("goodsReceipts", "grnNumber receiptDate status")
    .populate("qualityInspections", "inspectionNumber inspectionDate overallResult status")
    .populate("items.material", "materialCode materialName unitOfMeasure standardCost")
    .populate("createdBy", "name email role")
    .populate("verification.verifiedBy", "name email")
    .populate("approval.approvedBy", "name email")
    .populate("approval.rejectedBy", "name email")
    .populate("payment.paidBy", "name email");

  if (!invoice) {
    throw new Error("Invoice not found.");
  }

  // Vendor role security
  if (user && user.role === "VENDOR") {
    if (String(invoice.vendor?._id || invoice.vendor) !== String(user.vendor)) {
      throw new Error("You are not authorized to view this invoice.");
    }
  }

  return invoice;
};

/**
 * =========================================================
 * 5. Update Invoice (Draft or Rejected status only)
 * =========================================================
 */
export const updateInvoice = async (id, data, user) => {
  const invoice = await Invoice.findOne({ _id: id, isDeleted: false });
  if (!invoice) throw new Error("Invoice not found.");

  if (!["Draft", "Rejected"].includes(invoice.status)) {
    throw new Error(`Invoices in status "${invoice.status}" cannot be edited.`);
  }

  if (user.role === "VENDOR" && String(invoice.vendor) !== String(user.vendor)) {
    throw new Error("Unauthorized.");
  }

  // If items or dates updated
  if (data.items && data.items.length > 0) {
    let subtotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;

    const processedItems = data.items.map((item) => {
      const qty = Number(item.invoicedQuantity || 0);
      const price = Number(item.unitPrice || 0);
      const disc = Number(item.discountPercentage || 0);
      const tax = Number(item.taxPercentage || 0);

      const gross = qty * price;
      const dAmt = (gross * disc) / 100;
      const taxable = gross - dAmt;
      const tAmt = (taxable * tax) / 100;
      const lTotal = taxable + tAmt;

      subtotal += gross;
      discountAmount += dAmt;
      taxAmount += tAmt;

      return {
        ...item,
        taxAmount: tAmt,
        discountAmount: dAmt,
        lineTotal: lTotal,
      };
    });

    const freight = Number(data.freightCharges !== undefined ? data.freightCharges : invoice.freightCharges || 0);
    const totalAmount = subtotal - discountAmount + taxAmount + freight;

    invoice.items = processedItems;
    invoice.subtotal = subtotal;
    invoice.taxAmount = taxAmount;
    invoice.discountAmount = discountAmount;
    invoice.freightCharges = freight;
    invoice.totalAmount = totalAmount;
    invoice.payment.outstandingAmount = totalAmount - (invoice.payment.paidAmount || 0);
  }

  if (data.invoiceDate) invoice.invoiceDate = new Date(data.invoiceDate);
  if (data.dueDate) invoice.dueDate = new Date(data.dueDate);
  if (data.vendorRemarks !== undefined) invoice.vendorRemarks = data.vendorRemarks;
  if (data.adminRemarks !== undefined) invoice.adminRemarks = data.adminRemarks;
  if (data.status) invoice.status = data.status;

  invoice.updatedBy = user._id;
  await invoice.save();

  return await getInvoiceById(invoice._id);
};

/**
 * =========================================================
 * 6. Submit Invoice
 * =========================================================
 */
export const submitInvoice = async (id, user) => {
  const invoice = await Invoice.findOne({ _id: id, isDeleted: false });
  if (!invoice) throw new Error("Invoice not found.");

  if (invoice.status !== "Draft") {
    throw new Error("Only Draft invoices can be submitted.");
  }

  if (user.role === "VENDOR" && String(invoice.vendor) !== String(user.vendor)) {
    throw new Error("Unauthorized.");
  }

  invoice.status = "Submitted";
  invoice.updatedBy = user._id;
  await invoice.save();

  return await getInvoiceById(invoice._id);
};

/**
 * =========================================================
 * 7. Verify Invoice (Admin / Finance)
 * =========================================================
 */
export const verifyInvoice = async (id, verificationData, userId) => {
  const invoice = await Invoice.findOne({ _id: id, isDeleted: false });
  if (!invoice) throw new Error("Invoice not found.");

  if (!["Submitted", "Under Review", "Draft"].includes(invoice.status)) {
    throw new Error(`Cannot verify invoice in "${invoice.status}" status.`);
  }

  const {
    poMatched = true,
    grnMatched = true,
    qualityMatched = true,
    priceMatched = true,
    taxMatched = true,
    verificationRemarks = "",
  } = verificationData || {};

  invoice.verification = {
    isVerified: true,
    verifiedBy: userId,
    verifiedAt: new Date(),
    poMatched,
    grnMatched,
    qualityMatched,
    priceMatched,
    taxMatched,
    verificationRemarks,
  };

  invoice.status = "Verified";
  invoice.updatedBy = userId;
  await invoice.save();

  return await getInvoiceById(invoice._id);
};

/**
 * =========================================================
 * 8. Approve Invoice (Admin / Finance)
 * =========================================================
 */
export const approveInvoice = async (id, approvalData, userId) => {
  const invoice = await Invoice.findOne({ _id: id, isDeleted: false });
  if (!invoice) throw new Error("Invoice not found.");

  if (!["Verified", "Submitted", "Under Review"].includes(invoice.status)) {
    throw new Error(`Invoice cannot be approved in "${invoice.status}" status.`);
  }

  invoice.approval = {
    ...invoice.approval,
    approvedBy: userId,
    approvedAt: new Date(),
    approvalRemarks: approvalData?.approvalRemarks || "",
  };

  invoice.status = "Approved";
  invoice.updatedBy = userId;
  await invoice.save();

  return await getInvoiceById(invoice._id);
};

/**
 * =========================================================
 * 9. Reject Invoice (Admin / Finance)
 * =========================================================
 */
export const rejectInvoice = async (id, reason, userId) => {
  const invoice = await Invoice.findOne({ _id: id, isDeleted: false });
  if (!invoice) throw new Error("Invoice not found.");

  if (!reason || !reason.trim()) {
    throw new Error("Rejection reason is required.");
  }

  invoice.approval = {
    ...invoice.approval,
    rejectedBy: userId,
    rejectedAt: new Date(),
    rejectionReason: reason.trim(),
  };

  invoice.status = "Rejected";
  invoice.updatedBy = userId;
  await invoice.save();

  return await getInvoiceById(invoice._id);
};

/**
 * =========================================================
 * 10. Dispute Invoice (Admin / Finance)
 * =========================================================
 */
export const disputeInvoice = async (id, disputeReason, userId) => {
  const invoice = await Invoice.findOne({ _id: id, isDeleted: false });
  if (!invoice) throw new Error("Invoice not found.");

  if (!disputeReason || !disputeReason.trim()) {
    throw new Error("Dispute reason is required.");
  }

  invoice.approval = {
    ...invoice.approval,
    disputeReason: disputeReason.trim(),
    disputeResolved: false,
  };

  invoice.status = "Disputed";
  invoice.updatedBy = userId;
  await invoice.save();

  return await getInvoiceById(invoice._id);
};

/**
 * =========================================================
 * 11. Record Invoice Payment (Admin / Finance)
 * =========================================================
 */
export const recordInvoicePayment = async (id, paymentData, userId) => {
  const invoice = await Invoice.findOne({ _id: id, isDeleted: false });
  if (!invoice) throw new Error("Invoice not found.");

  if (!["Approved", "Payment Processing", "Partially Paid"].includes(invoice.status) && invoice.payment.paymentStatus === "Paid") {
    throw new Error("Payment can only be recorded on approved or processing invoices.");
  }

  const {
    amount,
    paymentMethod = "Bank Transfer",
    paymentReference = "",
    paymentDate = new Date(),
    paymentRemarks = "",
  } = paymentData;

  const paymentAmount = Math.round((Number(amount) || 0) * 100) / 100;
  if (paymentAmount <= 0) {
    throw new Error("Payment amount must be greater than 0.");
  }

  const currentPaid = Math.round(Number(invoice.payment?.paidAmount || 0) * 100) / 100;
  const newTotalPaid = Math.round((currentPaid + paymentAmount) * 100) / 100;
  let outstanding = Math.max(0, Math.round((Number(invoice.totalAmount || 0) - newTotalPaid) * 100) / 100);
  if (outstanding < 0.01) outstanding = 0;

  const isFullyPaid = outstanding <= 0;

  invoice.payment = {
    paymentStatus: isFullyPaid ? "Paid" : "Partially Paid",
    paidAmount: newTotalPaid,
    outstandingAmount: outstanding,
    paymentDate: new Date(paymentDate),
    paymentReference: paymentReference.trim(),
    paymentMethod,
    paymentRemarks: paymentRemarks.trim(),
    paidBy: userId,
  };

  invoice.status = isFullyPaid ? "Paid" : "Payment Processing";
  invoice.updatedBy = userId;
  await invoice.save();

  return await getInvoiceById(invoice._id);
};

/**
 * =========================================================
 * 12. Delete Invoice (Soft Delete)
 * =========================================================
 */
export const deleteInvoice = async (id, userId) => {
  const invoice = await Invoice.findOne({ _id: id, isDeleted: false });
  if (!invoice) throw new Error("Invoice not found.");

  if (["Approved", "Paid", "Payment Processing"].includes(invoice.status)) {
    throw new Error(`Approved or paid invoices cannot be deleted.`);
  }

  invoice.isDeleted = true;
  invoice.updatedBy = userId;
  await invoice.save();

  return { success: true, message: "Invoice deleted successfully." };
};

/**
 * =========================================================
 * 13. Get Invoice Dashboard Analytics
 * =========================================================
 */
export const getInvoiceDashboardStats = async (user) => {
  const match = { isDeleted: false };

  if (user && user.role === "VENDOR") {
    if (!user.vendor) {
      throw new Error("Vendor user is not associated with a vendor profile.");
    }
    match.vendor = new mongoose.Types.ObjectId(user.vendor);
  }

  const totalInvoices = await Invoice.countDocuments(match);
  const pendingReview = await Invoice.countDocuments({ ...match, status: { $in: ["Submitted", "Under Review"] } });
  const verified = await Invoice.countDocuments({ ...match, status: "Verified" });
  const approved = await Invoice.countDocuments({ ...match, status: "Approved" });
  const paid = await Invoice.countDocuments({ ...match, status: "Paid" });
  const rejected = await Invoice.countDocuments({ ...match, status: "Rejected" });
  const disputed = await Invoice.countDocuments({ ...match, status: "Disputed" });

  const amountTotals = await Invoice.aggregate([
    { $match: match },
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
    totalInvoices,
    pendingReview,
    verified,
    approved,
    paid,
    rejected,
    disputed,
    totalInvoicedAmount: amountTotals[0]?.totalInvoicedAmount || 0,
    totalPaidAmount: amountTotals[0]?.totalPaidAmount || 0,
    totalOutstandingAmount: amountTotals[0]?.totalOutstandingAmount || 0,
  };
};

const invoiceService = {
  generateInvoiceNumber,
  calculatePOInvoiceableDetails,
  getEligiblePurchaseOrders,
  createInvoice,
  getAllInvoices,
  getInvoiceById,
  updateInvoice,
  submitInvoice,
  verifyInvoice,
  approveInvoice,
  rejectInvoice,
  disputeInvoice,
  recordInvoicePayment,
  deleteInvoice,
  getInvoiceDashboardStats,
};

export default invoiceService;
