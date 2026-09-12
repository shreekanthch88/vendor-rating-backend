import PurchaseOrder from "../models/PurchaseOrder.js";
import { createForRole } from "./notificationService.js";

/**
 * ===========================================
 * Get Vendor Purchase Orders
 * ===========================================
 *
 * Only returns Purchase Orders belonging
 * to the logged-in vendor.
 */
export const getVendorPurchaseOrders = async (
  vendorId,
  {
    page = 1,
    limit = 10,
    search = "",
    status = "",
  } = {}
) => {
  const query = {
    vendor: vendorId,
    isDeleted: false,
  };

  if (search) {
    query.poNumber = {
      $regex: search,
      $options: "i",
    };
  }

  if (status) {
    query.status = status;
  }

  const total =
    await PurchaseOrder.countDocuments(query);

  const purchaseOrders =
    await PurchaseOrder.find(query)
      .populate(
        "purchaseRequisition",
        "prNumber department requiredDate priority purpose"
      )
      .populate(
        "vendor",
        "vendorCode vendorName companyName email phone"
      )
      .populate(
        "items.material",
        "materialCode materialName unitOfMeasure"
      )
      .sort({
        createdAt: -1,
      })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

  return {
    purchaseOrders,
    total,
    page: Number(page),
    pages: Math.ceil(
      total / Number(limit)
    ),
  };
};

/**
 * ===========================================
 * Get Vendor Purchase Order By ID
 * ===========================================
 */
export const getVendorPurchaseOrderById =
  async (vendorId, purchaseOrderId) => {
    const purchaseOrder =
      await PurchaseOrder.findOne({
        _id: purchaseOrderId,
        vendor: vendorId,
        isDeleted: false,
      })
        .populate(
          "purchaseRequisition",
          "prNumber department requiredDate priority purpose"
        )
        .populate(
          "vendor",
          "vendorCode vendorName companyName email phone address"
        )
        .populate(
          "createdBy",
          "name email"
        )
        .populate(
          "approvedBy",
          "name email"
        )
        .populate(
          "items.material",
          "materialCode materialName unitOfMeasure standardCost"
        );

    if (!purchaseOrder) {
      throw new Error(
        "Purchase Order not found."
      );
    }

    return purchaseOrder;
  };

/**
 * ===========================================
 * Accept Vendor Purchase Order
 * ===========================================
 */
export const acceptVendorPurchaseOrder =
  async (
    vendorId,
    purchaseOrderId,
    remarks = ""
  ) => {
    const purchaseOrder =
      await PurchaseOrder.findOne({
        _id: purchaseOrderId,
        vendor: vendorId,
        isDeleted: false,
      });

    if (!purchaseOrder) {
      throw new Error(
        "Purchase Order not found."
      );
    }

    if (purchaseOrder.status !== "Sent") {
      const error = new Error(
        "Purchase Order cannot be accepted in its current status."
      );
      error.statusCode = 409;
      throw error;
    }

    purchaseOrder.status = "Accepted";
    purchaseOrder.vendorAccepted = true;
    purchaseOrder.vendorResponseDate =
      new Date();
    purchaseOrder.vendorRemarks =
      remarks;

    await purchaseOrder.save();

    // 🔔 Notify admin & purchase managers (In-App + Email)
    createForRole(["SUPER_ADMIN", "ADMIN", "PURCHASE_MANAGER"], {
      category: "purchase_order",
      priority: "info",
      title: "Vendor Accepted Purchase Order",
      message: `${purchaseOrder.poNumber} has been accepted by the vendor.${remarks ? ` Remarks: ${remarks}` : ""}`,
      sourceModel: "PurchaseOrder",
      sourceId: purchaseOrder._id,
      actionUrl: `/purchase-orders?id=${purchaseOrder._id}`,
      actionLabel: "View Purchase Order",
      sendEmailNotification: true,
    });

    return purchaseOrder;
  };

/**
 * ===========================================
 * Reject Vendor Purchase Order
 * ===========================================
 */
export const rejectVendorPurchaseOrder =
  async (
    vendorId,
    purchaseOrderId,
    remarks = ""
  ) => {
    const purchaseOrder =
      await PurchaseOrder.findOne({
        _id: purchaseOrderId,
        vendor: vendorId,
        isDeleted: false,
      });

    if (!purchaseOrder) {
      throw new Error(
        "Purchase Order not found."
      );
    }

    if (purchaseOrder.status !== "Sent") {
      const error = new Error(
        "Purchase Order cannot be rejected in its current status."
      );
      error.statusCode = 409;
      throw error;
    }

    if (!remarks.trim()) {
      throw new Error(
        "Rejection remarks are required."
      );
    }

    purchaseOrder.status = "Rejected";
    purchaseOrder.vendorAccepted = false;
    purchaseOrder.vendorResponseDate =
      new Date();
    purchaseOrder.vendorRemarks =
      remarks.trim();

    await purchaseOrder.save();

    // 🔔 Notify admin & purchase managers (In-App + Email)
    createForRole(["SUPER_ADMIN", "ADMIN", "PURCHASE_MANAGER"], {
      category: "purchase_order",
      priority: "critical",
      title: "Vendor Rejected Purchase Order",
      message: `${purchaseOrder.poNumber} has been rejected by the vendor. Reason: ${remarks || "No reason provided"}.`,
      sourceModel: "PurchaseOrder",
      sourceId: purchaseOrder._id,
      actionUrl: `/purchase-orders?id=${purchaseOrder._id}`,
      actionLabel: "View Purchase Order",
      sendEmailNotification: true,
    });

    return purchaseOrder;
  };
