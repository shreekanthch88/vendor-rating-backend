import mongoose from "mongoose";
import PurchaseOrder from "../models/PurchaseOrder.js";
import PurchaseRequisition from "../models/PurchaseRequisition.js";
import { createForVendor, createForRole } from "./notificationService.js";

/**
 * ===========================================
 * Generate PO Number
 * Format : PO000001
 * ===========================================
 */
const generatePONumber = async () => {
  const lastPO = await PurchaseOrder.findOne()
    .sort({ createdAt: -1 })
    .select("poNumber");

  if (!lastPO) {
    return "PO000001";
  }

  const lastNumber = parseInt(
    lastPO.poNumber.replace("PO", ""),
    10
  );

  return `PO${String(lastNumber + 1).padStart(6, "0")}`;
};

/**
 * ===========================================
 * Calculate Purchase Order Totals
 * ===========================================
 */
const calculateTotals = (items, freightCharges = 0) => {

  let subtotal = 0;
  let taxAmount = 0;
  let discountAmount = 0;

  const updatedItems = items.map((item) => {

    const lineAmount =
      Number(item.quantity) *
      Number(item.unitPrice);

    const discount =
      (lineAmount *
        Number(item.discountPercentage || 0)) /
      100;

    const taxableAmount =
      lineAmount - discount;

    const tax =
      (taxableAmount *
        Number(item.taxPercentage || 0)) /
      100;

    const lineTotal =
      taxableAmount + tax;

    subtotal += lineAmount;
    discountAmount += discount;
    taxAmount += tax;

    return {
      ...item,
      lineTotal,
    };
  });

  return {
    items: updatedItems,
    subtotal,
    taxAmount,
    discountAmount,
    grandTotal:
      subtotal -
      discountAmount +
      taxAmount +
      Number(freightCharges || 0),
  };
};

/**
 * ===========================================
 * Create Purchase Order
 * ===========================================
 */
export const createPurchaseOrder = async (
  data,
  userId
) => {

  const purchaseRequisition =
    await PurchaseRequisition.findById(
      data.purchaseRequisition
    );

  if (!purchaseRequisition) {
    throw new Error(
      "Purchase Requisition not found."
    );
  }

  if (
    purchaseRequisition.status !== "Approved"
  ) {
    throw new Error(
      "Only Approved Purchase Requisitions can be converted into Purchase Orders."
    );
  }

  const poNumber =
    await generatePONumber();

  const totals =
    calculateTotals(
      data.items,
      data.freightCharges
    );
      const purchaseOrder =
    await PurchaseOrder.create({
      ...data,

      poNumber,

      items: totals.items,

      subtotal: totals.subtotal,

      taxAmount: totals.taxAmount,

      discountAmount:
        totals.discountAmount,

      grandTotal:
        totals.grandTotal,

      createdBy: userId,
    });

  return await PurchaseOrder.findById(
    purchaseOrder._id
  )
    .populate(
      "purchaseRequisition",
      "prNumber department requiredDate priority"
    )
    .populate(
      "vendor",
      "vendorCode vendorName companyName email phone"
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
      "materialCode materialName unitOfMeasure"
    );
};

/**
 * ===========================================
 * Get All Purchase Orders
 * ===========================================
 */

export const getAllPurchaseOrders =
  async ({
    page = 1,
    limit = 10,
    search = "",
    status = "",
    vendor = "",
  }) => {

    const query = {
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

    if (vendor) {
      query.vendor = vendor;
    }

    const total =
      await PurchaseOrder.countDocuments(
        query
      );

    const purchaseOrders =
      await PurchaseOrder.find(query)

        .populate(
          "purchaseRequisition",
          "prNumber"
        )

        .populate(
          "vendor",
          "vendorName companyName"
        )

        .sort({
          createdAt: -1,
        })

        .skip((page - 1) * limit)

        .limit(Number(limit));

    return {
      purchaseOrders,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    };
  };

  /**
 * ===========================================
 * Get Purchase Order By ID
 * ===========================================
 */

export const getPurchaseOrderById = async (id) => {

  return await PurchaseOrder.findById(id)

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
      "updatedBy",
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

};

/**
 * ===========================================
 * Update Purchase Order
 * ===========================================
 */

export const updatePurchaseOrder = async (
  id,
  data,
  userId
) => {

  const purchaseOrder =
    await PurchaseOrder.findById(id);

  if (!purchaseOrder) {
    throw new Error(
      "Purchase Order not found."
    );
  }

  if (
    purchaseOrder.status !== "Draft"
  ) {
    throw new Error(
      "Only Draft Purchase Orders can be updated."
    );
  }

  const totals =
    calculateTotals(
      data.items,
      data.freightCharges
    );

  return await PurchaseOrder.findByIdAndUpdate(
    id,
    {
      ...data,

      items: totals.items,

      subtotal: totals.subtotal,

      taxAmount: totals.taxAmount,

      discountAmount:
        totals.discountAmount,

      grandTotal:
        totals.grandTotal,

      updatedBy: userId,
    },
    {
      new: true,
      runValidators: true,
    }
  )

    .populate(
      "purchaseRequisition",
      "prNumber"
    )

    .populate(
      "vendor",
      "vendorName companyName"
    )

    .populate(
      "items.material",
      "materialCode materialName"
    );

};

/**
 * ===========================================
 * Delete Purchase Order
 * Soft Delete
 * ===========================================
 */

export const deletePurchaseOrder =
  async (
    id,
    userId
  ) => {

    const purchaseOrder =
      await PurchaseOrder.findById(id);

    if (!purchaseOrder) {
      throw new Error(
        "Purchase Order not found."
      );
    }

    if (
      purchaseOrder.status !== "Draft"
    ) {
      throw new Error(
        "Only Draft Purchase Orders can be deleted."
      );
    }

    return await PurchaseOrder.findByIdAndUpdate(
      id,
      {
        isDeleted: true,
        updatedBy: userId,
      },
      {
        new: true,
      }
    );

  };

  /**
 * ===========================================
 * Submit Purchase Order
 * ===========================================
 */

export const submitPurchaseOrder = async (
  id,
  userId
) => {

  const purchaseOrder =
    await PurchaseOrder.findById(id);

  if (!purchaseOrder) {
    throw new Error(
      "Purchase Order not found."
    );
  }

  if (purchaseOrder.status !== "Draft") {
    throw new Error(
      "Only Draft Purchase Orders can be submitted."
    );
  }

  return await PurchaseOrder.findByIdAndUpdate(
    id,
    {
      status: "Submitted",
      updatedBy: userId,
    },
    {
      new: true,
    }
  );
};

/**
 * ===========================================
 * Approve Purchase Order
 * ===========================================
 */

export const approvePurchaseOrder = async (
  id,
  userId
) => {

  const purchaseOrder =
    await PurchaseOrder.findById(id);

  if (!purchaseOrder) {
    throw new Error(
      "Purchase Order not found."
    );
  }

  if (purchaseOrder.status !== "Submitted") {
    throw new Error(
      "Only Submitted Purchase Orders can be approved."
    );
  }

  return await PurchaseOrder.findByIdAndUpdate(
    id,
    {
      status: "Approved",
      approvedBy: userId,
      approvedDate: new Date(),
    },
    {
      new: true,
    }
  );
};

/**
 * ===========================================
 * Reject Purchase Order
 * ===========================================
 */

export const rejectPurchaseOrder = async (
  id,
  reason,
  userId
) => {

  const purchaseOrder =
    await PurchaseOrder.findById(id);

  if (!purchaseOrder) {
    throw new Error(
      "Purchase Order not found."
    );
  }

  if (purchaseOrder.status !== "Submitted") {
    throw new Error(
      "Only Submitted Purchase Orders can be rejected."
    );
  }

  return await PurchaseOrder.findByIdAndUpdate(
    id,
    {
      status: "Rejected",
      rejectionReason: reason,
      updatedBy: userId,
    },
    {
      new: true,
    }
  );
};

/**
 * ===========================================
 * Send Purchase Order To Vendor
 * ===========================================
 */

export const sendPurchaseOrderToVendor =
  async (
    id,
    userId
  ) => {

    const purchaseOrder =
      await PurchaseOrder.findById(id);

    if (!purchaseOrder) {
      throw new Error(
        "Purchase Order not found."
      );
    }

    if (purchaseOrder.status !== "Approved") {
      throw new Error(
        "Only Approved Purchase Orders can be sent to the vendor."
      );
    }

    const updated = await PurchaseOrder.findByIdAndUpdate(
      id,
      {
        status: "Sent",
        sentToVendor: true,
        sentDate: new Date(),
        updatedBy: userId,
      },
      { new: true }
    ).populate("vendor", "_id vendorCode vendorName poNumber");

    // 🔔 Notify vendor
    createForVendor(updated.vendor?._id || updated.vendor, {
      category: "purchase_order",
      priority: "action",
      title: "New Purchase Order Received",
      message: `${updated.poNumber} has been sent to you. Please review and respond.`,
      sourceModel: "PurchaseOrder",
      sourceId: updated._id,
      actionUrl: `/vendor/purchase-orders/${updated._id}`,
      actionLabel: "View Purchase Order",
    });

    return updated;
  };

  /**
 * ===========================================
 * Vendor Accept Purchase Order
 * ===========================================
 */

export const vendorAcceptPurchaseOrder = async (
  id,
  remarks = ""
) => {

  const purchaseOrder =
    await PurchaseOrder.findById(id);

  if (!purchaseOrder) {
    throw new Error(
      "Purchase Order not found."
    );
  }

  if (purchaseOrder.status !== "Sent") {
    throw new Error(
      "Only Sent Purchase Orders can be accepted."
    );
  }

  const accepted = await PurchaseOrder.findByIdAndUpdate(
    id,
    {
      status: "Accepted",
      vendorAccepted: true,
      vendorResponseDate: new Date(),
      vendorRemarks: remarks,
    },
    { new: true }
  );

  // 🔔 Notify admin/purchase managers
  createForRole(["SUPER_ADMIN", "ADMIN", "PURCHASE_MANAGER"], {
    category: "purchase_order",
    priority: "info",
    title: "Vendor Accepted Purchase Order",
    message: `${accepted.poNumber} has been accepted by the vendor.`,
    sourceModel: "PurchaseOrder",
    sourceId: accepted._id,
    actionUrl: `/purchase-orders?id=${accepted._id}`,
    actionLabel: "View Purchase Order",
  });

  return accepted;
};

/**
 * ===========================================
 * Vendor Reject Purchase Order
 * ===========================================
 */

export const vendorRejectPurchaseOrder = async (
  id,
  remarks
) => {

  const purchaseOrder =
    await PurchaseOrder.findById(id);

  if (!purchaseOrder) {
    throw new Error(
      "Purchase Order not found."
    );
  }

  if (purchaseOrder.status !== "Sent") {
    throw new Error(
      "Only Sent Purchase Orders can be rejected."
    );
  }

  const rejected = await PurchaseOrder.findByIdAndUpdate(
    id,
    {
      status: "Rejected",
      vendorAccepted: false,
      vendorResponseDate: new Date(),
      vendorRemarks: remarks,
    },
    { new: true }
  );

  // 🔔 Notify admin/purchase managers
  createForRole(["SUPER_ADMIN", "ADMIN", "PURCHASE_MANAGER"], {
    category: "purchase_order",
    priority: "critical",
    title: "Vendor Rejected Purchase Order",
    message: `${rejected.poNumber} has been rejected by the vendor. Reason: ${remarks || "No reason provided"}.`,
    sourceModel: "PurchaseOrder",
    sourceId: rejected._id,
    actionUrl: `/purchase-orders?id=${rejected._id}`,
    actionLabel: "View Purchase Order",
  });

  return rejected;
};

/**
 * ===========================================
 * Purchase Order Dashboard
 * ===========================================
 */

export const getPurchaseOrderDashboard = async () => {

  const total = await PurchaseOrder.countDocuments({
    isDeleted: false,
  });

  const draft = await PurchaseOrder.countDocuments({
    status: "Draft",
    isDeleted: false,
  });

  const submitted = await PurchaseOrder.countDocuments({
    status: "Submitted",
    isDeleted: false,
  });

  const approved = await PurchaseOrder.countDocuments({
    status: "Approved",
    isDeleted: false,
  });

  const sent = await PurchaseOrder.countDocuments({
    status: "Sent",
    isDeleted: false,
  });

  const accepted = await PurchaseOrder.countDocuments({
    status: "Accepted",
    isDeleted: false,
  });

  const rejected = await PurchaseOrder.countDocuments({
    status: "Rejected",
    isDeleted: false,
  });

  const delivered = await PurchaseOrder.countDocuments({
    status: "Delivered",
    isDeleted: false,
  });

  const cancelled = await PurchaseOrder.countDocuments({
    status: "Cancelled",
    isDeleted: false,
  });

  const totalValue = await PurchaseOrder.aggregate([
    {
      $match: {
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: null,
        total: {
          $sum: "$grandTotal",
        },
      },
    },
  ]);

  return {
    total,
    draft,
    submitted,
    approved,
    sent,
    accepted,
    rejected,
    delivered,
    cancelled,
    totalValue: totalValue[0]?.total || 0,
  };

};

/**
 * ===========================================
 * Purchase Order Charts
 * ===========================================
 */

export const getPurchaseOrderCharts = async () => {

  const trendData = await PurchaseOrder.aggregate([
    {
      $match: {
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: {
          month: {
            $month: "$createdAt",
          },
        },
        orders: {
          $sum: 1,
        },
      },
    },
    {
      $sort: {
        "_id.month": 1,
      },
    },
  ]);

  const statusData = await PurchaseOrder.aggregate([
    {
      $match: {
        isDeleted: false,
      },
    },
    {
      $group: {
        _id: "$status",
        count: {
          $sum: 1,
        },
      },
    },
  ]);

  const departmentData = await PurchaseOrder.aggregate([
    {
      $match: {
        isDeleted: false,
      },
    },
    {
      $lookup: {
        from: "purchaserequisitions",
        localField: "purchaseRequisition",
        foreignField: "_id",
        as: "purchaseRequisition",
      },
    },
    {
      $unwind: "$purchaseRequisition",
    },
    {
      $group: {
        _id: "$purchaseRequisition.department",
        orders: {
          $sum: 1,
        },
      },
    },
  ]);

  const vendorData = await PurchaseOrder.aggregate([
    {
      $match: {
        isDeleted: false,
      },
    },
    {
      $lookup: {
        from: "vendors",
        localField: "vendor",
        foreignField: "_id",
        as: "vendor",
      },
    },
    {
      $unwind: "$vendor",
    },
    {
      $group: {
        _id: "$vendor.vendorName",
        orders: {
          $sum: 1,
        },
      },
    },
  ]);

  return {
    trendData: trendData.map(item => ({
      month: item._id.month,
      orders: item.orders,
    })),

    statusData: statusData.map(item => ({
      status: item._id,
      count: item.count,
    })),

    departmentData: departmentData.map(item => ({
      department: item._id,
      orders: item.orders,
    })),

    vendorData: vendorData.map(item => ({
      vendor: item._id,
      orders: item.orders,
    })),
  };

};


// =========================================================
// GET PURCHASE ORDER FULFILLMENT
// =========================================================
//
// Calculates the actual fulfillment of a Purchase Order.
//
// IMPORTANT:
//
// Original accepted quantity comes from QualityInspection.
//
// Replacement accepted quantity comes from
// ReplacementRequest items.
//
// Dispatch / receipt quantities alone are NOT considered
// fulfilled quantities.
//
// Final Fulfilled:
//     Original Accepted
//     +
//     Replacement Accepted
//
// Final Fulfilled cannot exceed PO ordered quantity.
//
// =========================================================

export const getPurchaseOrderFulfillment = async (
  purchaseOrderId
) => {

  // =======================================================
  // VALIDATE ID
  // =======================================================

  if (
    !mongoose.Types.ObjectId.isValid(
      purchaseOrderId
    )
  ) {
    throw new Error(
      "Invalid Purchase Order ID."
    );
  }


  // =======================================================
  // FIND PURCHASE ORDER
  // =======================================================

  const purchaseOrder =
    await PurchaseOrder.findOne({

      _id: purchaseOrderId,

      isDeleted: false,

    }).lean();


  if (!purchaseOrder) {
    throw new Error(
      "Purchase Order not found."
    );
  }


  // =======================================================
  // IMPORT MODELS
  // =======================================================

  const Dispatch =
    mongoose.model("Dispatch");

  const GoodsReceipt =
    mongoose.model("GoodsReceipt");

  const QualityInspection =
    mongoose.model("QualityInspection");

  const ReplacementRequest =
    mongoose.model("ReplacementRequest");


  // =======================================================
  // ORIGINAL DISPATCH QUANTITY
  // =======================================================

  const dispatches =
    await Dispatch.find({

      purchaseOrder:
        purchaseOrderId,

      isDeleted:
        false,

      dispatchType: {
        $ne: "Replacement",
      },

    }).lean();


  let originalDispatchedQuantity = 0;


  for (
    const dispatch
    of dispatches
  ) {

    for (
      const item
      of dispatch.items || []
    ) {

      originalDispatchedQuantity +=
        Number(
          item.dispatchQuantity || 0
        );

    }

  }


  // =======================================================
  // ORIGINAL GOODS RECEIPTS
  // =======================================================

  const goodsReceipts =
    await GoodsReceipt.find({

      purchaseOrder:
        purchaseOrderId,

      isDeleted:
        false,

      receiptType:
        "Normal",

    }).lean();


  let originalReceivedQuantity = 0;


  for (
    const goodsReceipt
    of goodsReceipts
  ) {

    for (
      const item
      of goodsReceipt.items || []
    ) {

      originalReceivedQuantity +=
        Number(
          item.receivedQuantity || 0
        );

    }

  }


  // =======================================================
  // ORIGINAL QUALITY INSPECTIONS
  // =======================================================

  const qualityInspections =
    await QualityInspection.find({

      purchaseOrder:
        purchaseOrderId,

      isDeleted:
        false,

      status:
        "Completed",

    }).lean();


  let originalAcceptedQuantity = 0;

  let originalRejectedQuantity = 0;

  let originalDamagedQuantity = 0;

  let originalShortQuantity = 0;


  for (
    const inspection
    of qualityInspections
  ) {

    for (
      const item
      of inspection.items || []
    ) {

      originalAcceptedQuantity +=
        Number(
          item.acceptedQuantity || 0
        );

      originalRejectedQuantity +=
        Number(
          item.rejectedQuantity || 0
        );

      originalDamagedQuantity +=
        Number(
          item.damagedQuantity || 0
        );

      originalShortQuantity +=
        Number(
          item.inspectionShortQuantity || 0
        );

    }

  }


  // =======================================================
  // REPLACEMENT REQUESTS
  // =======================================================

  const replacementRequests =
    await ReplacementRequest.find({

      purchaseOrder:
        purchaseOrderId,

      isDeleted:
        false,

    }).lean();


  let replacementRequestedQuantity = 0;

  let replacementApprovedQuantity = 0;

  let replacementDispatchedQuantity = 0;

  let replacementReceivedQuantity = 0;

  let replacementAcceptedQuantity = 0;

  let replacementRejectedQuantity = 0;

  let replacementDamagedQuantity = 0;


  for (
    const request
    of replacementRequests
  ) {

    for (
      const item
      of request.items || []
    ) {

      replacementRequestedQuantity +=
        Number(
          item.replacementQuantity || 0
        );

      replacementApprovedQuantity +=
        Number(
          item.replacementApprovedQuantity || 0
        );

      replacementDispatchedQuantity +=
        Number(
          item.replacementDispatchedQuantity || 0
        );

      replacementReceivedQuantity +=
        Number(
          item.replacementReceivedQuantity || 0
        );

      replacementAcceptedQuantity +=
        Number(
          item.replacementAcceptedQuantity || 0
        );

      replacementRejectedQuantity +=
        Number(
          item.replacementRejectedQuantity || 0
        );

      replacementDamagedQuantity +=
        Number(
          item.replacementDamagedQuantity || 0
        );

    }

  }


  // =======================================================
  // PO ORDERED QUANTITY
  // =======================================================

  const orderedQuantity =
    (purchaseOrder.items || [])
      .reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.quantity || 0
          ),
        0
      );


  // =======================================================
  // FINAL FULFILLED QUANTITY
  // =======================================================
  //
  // Only accepted quantities count.
  //
  // Replacement quantities are added to the original
  // accepted quantity.
  //
  // Never allow fulfillment to exceed the PO quantity.
  //

  const finalFulfilledQuantity =
    Math.min(
      orderedQuantity,
      originalAcceptedQuantity +
        replacementAcceptedQuantity
    );


  // =======================================================
  // FINAL PENDING QUANTITY
  // =======================================================

  const finalPendingQuantity =
    Math.max(
      0,
      orderedQuantity -
        finalFulfilledQuantity
    );


  // =======================================================
  // FULFILLMENT PERCENTAGE
  // =======================================================

  const fulfillmentPercentage =
    orderedQuantity > 0
      ? Number(
          (
            (
              finalFulfilledQuantity /
              orderedQuantity
            ) *
            100
          ).toFixed(2)
        )
      : 0;


  // =======================================================
  // RETURN
  // =======================================================

  return {

    purchaseOrder: {
      _id:
        purchaseOrder._id,

      poNumber:
        purchaseOrder.poNumber,

      status:
        purchaseOrder.status,

      vendor:
        purchaseOrder.vendor,
    },


    orderedQuantity,


    original: {

      dispatchedQuantity:
        originalDispatchedQuantity,

      receivedQuantity:
        originalReceivedQuantity,

      acceptedQuantity:
        originalAcceptedQuantity,

      rejectedQuantity:
        originalRejectedQuantity,

      damagedQuantity:
        originalDamagedQuantity,

      shortQuantity:
        originalShortQuantity,

    },


    replacement: {

      requestedQuantity:
        replacementRequestedQuantity,

      approvedQuantity:
        replacementApprovedQuantity,

      dispatchedQuantity:
        replacementDispatchedQuantity,

      receivedQuantity:
        replacementReceivedQuantity,

      acceptedQuantity:
        replacementAcceptedQuantity,

      rejectedQuantity:
        replacementRejectedQuantity,

      damagedQuantity:
        replacementDamagedQuantity,

    },


    final: {

      fulfilledQuantity:
        finalFulfilledQuantity,

      pendingQuantity:
        finalPendingQuantity,

      fulfillmentPercentage,

      isFullyFulfilled:
        finalFulfilledQuantity >=
        orderedQuantity,

    },

  };

};