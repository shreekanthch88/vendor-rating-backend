// backend/src/services/replacementRequestService.js

import mongoose from "mongoose";

import ReplacementRequest from "../models/ReplacementRequest.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import Dispatch from "../models/Dispatch.js";
import Material from "../models/Material.js";
import QualityInspection from "../models/QualityInspection.js";


// =========================================================
// INTERNAL HELPERS
// =========================================================

const isValidObjectId = (id) =>
  mongoose.Types.ObjectId.isValid(id);


const addHistory = (
  request,
  {
    action,
    previousStatus = "",
    newStatus = "",
    performedBy = null,
    remarks = "",
  }
) => {

  if (!Array.isArray(request.history)) {
    request.history = [];
  }

  request.history.push({
    action,
    previousStatus,
    newStatus,
    performedBy,
    performedAt: new Date(),
    remarks,
  });
};


const generateNextReplacementRequestNumber = async () => {
  const allRequests = await ReplacementRequest.find(
    {},
    { requestNumber: 1 }
  ).lean();

  let maxNumber = 0;
  for (const req of allRequests) {
    if (req.requestNumber) {
      const match = req.requestNumber.match(/(\d+)$/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > maxNumber) {
          maxNumber = val;
        }
      }
    }
  }

  let next = maxNumber + 1;
  let candidate = `RR${String(next).padStart(6, "0")}`;

  while (await ReplacementRequest.exists({ requestNumber: candidate })) {
    next++;
    candidate = `RR${String(next).padStart(6, "0")}`;
  }

  return candidate;
};


// =========================================================
// CREATE REPLACEMENT REQUEST
// =========================================================

export const createReplacementRequest = async ({
  purchaseOrderId,
  originalDispatchId,
  qualityInspectionId = null,
  goodsReceiptId = null,
  items,
  reason = "",
  remarks = "",
  requiredReplacementDate = null,
  requestedBy,
}) => {

  if (!requestedBy) {
    throw new Error(
      "Requester information is required."
    );
  }


  if (!isValidObjectId(purchaseOrderId)) {
    throw new Error(
      "Invalid Purchase Order ID."
    );
  }


  if (!isValidObjectId(originalDispatchId)) {
    throw new Error(
      "Invalid original dispatch ID."
    );
  }


  const purchaseOrder =
    await PurchaseOrder.findOne({
      _id: purchaseOrderId,
      isDeleted: false,
    });


  if (!purchaseOrder) {
    throw new Error(
      "Purchase Order not found."
    );
  }


  const originalDispatch =
    await Dispatch.findOne({
      _id: originalDispatchId,
      purchaseOrder: purchaseOrderId,
      isDeleted: false,
    });


  if (!originalDispatch) {
    throw new Error(
      "Original dispatch not found."
    );
  }


  const vendorId =
    originalDispatch.vendor;


  if (!vendorId) {
    throw new Error(
      "Vendor is not associated with the original dispatch."
    );
  }


  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(
      "At least one replacement item is required."
    );
  }


  // =======================================================
  // BUILD AND VALIDATE REPLACEMENT ITEMS
  // =======================================================

  const replacementItems = await Promise.all(
    items.map(async (item, index) => {

      const receivedQuantity =
        Number(
          item.receivedQuantity || 0
        );


      const originalAcceptedQuantity =
        Number(
          item.originalAcceptedQuantity || 0
        );


      const rejectedQuantity =
        Number(
          item.rejectedQuantity || 0
        );


      const damagedQuantity =
        Number(
          item.damagedQuantity || 0
        );


      const shortQuantity =
        Number(
          item.shortQuantity || 0
        );


      /*
       * IMPORTANT:
       *
       * Short quantity is NOT physically received.
       *
       * Therefore:
       *
       * rejected + damaged <= received
       *
       * Short is validated separately against the quantity
       * that was not received.
       */


      const replacementQuantity =
        Number(
          item.replacementQuantity ??
          (
            rejectedQuantity +
            damagedQuantity +
            shortQuantity
          )
        );


      // =====================================================
      // BASIC QUANTITY VALIDATION
      // =====================================================

      if (
        receivedQuantity < 0 ||
        originalAcceptedQuantity < 0 ||
        rejectedQuantity < 0 ||
        damagedQuantity < 0 ||
        shortQuantity < 0 ||
        replacementQuantity < 0
      ) {

        throw new Error(
          `Invalid quantity for replacement item ${index + 1}.`
        );

      }


      // =====================================================
      // PHYSICALLY RECEIVED QUANTITY VALIDATION
      // =====================================================
      //
      // Short quantity is intentionally excluded.
      //
      // Example:
      //
      // Received = 90
      // Rejected = 5
      // Damaged = 5
      // Short = 10
      //
      // 5 + 5 <= 90  -> VALID
      //
      // =====================================================

      if (
        rejectedQuantity +
        damagedQuantity >
        receivedQuantity
      ) {

        throw new Error(
          `Rejected and damaged quantity cannot exceed received quantity for item ${index + 1}.`
        );

      }


      // =====================================================
      // RECEIVED QUANTITY BREAKDOWN
      // =====================================================

      if (
        originalAcceptedQuantity +
        rejectedQuantity +
        damagedQuantity >
        receivedQuantity
      ) {

        throw new Error(
          `Accepted, rejected and damaged quantity cannot exceed received quantity for item ${index + 1}.`
        );

      }


      // =====================================================
      // SHORT QUANTITY VALIDATION
      // =====================================================
      //
      // Short quantity represents quantity ordered but not
      // physically received.
      //
      // We derive the maximum possible shortage from the
      // original PO item where possible.
      //
      // If PO item information is unavailable here, the
      // Quality Inspection / Replacement Decision remains
      // responsible for supplying the correct short quantity.
      //
      // We therefore do not compare shortQuantity against
      // receivedQuantity.
      //
      // =====================================================


      // =====================================================
      // MAXIMUM REPLACEMENT-ELIGIBLE QUANTITY
      // =====================================================

      const maximumReplacementQuantity =
        rejectedQuantity +
        damagedQuantity +
        shortQuantity;


      // =====================================================
      // REPLACEMENT QUANTITY VALIDATION
      // =====================================================

      if (
        replacementQuantity >
        maximumReplacementQuantity
      ) {

        throw new Error(
          `Replacement quantity cannot exceed rejected, damaged and short quantity for item ${index + 1}.`
        );

      }


      if (
        replacementQuantity <= 0
      ) {

        throw new Error(
          `Replacement quantity must be greater than zero for item ${index + 1}.`
        );

      }


      const materialId = item.material?._id || item.material;

      if (!materialId) {
        throw new Error(
          `Material is required for replacement item ${index + 1}.`
        );
      }

      let materialCode = (item.materialCode || "").trim();
      let materialName = (item.materialName || item.itemName || "").trim();
      let unitOfMeasure = (item.unitOfMeasure || item.uom || "").trim();

      // Look up in purchaseOrder.items if any detail is missing
      if (!materialCode || !materialName || !unitOfMeasure) {
        const poItem = purchaseOrder.items?.find(
          (pi) =>
            (pi.material?._id || pi.material || "").toString() ===
            materialId.toString()
        );
        if (poItem) {
          materialCode = materialCode || poItem.materialCode || "";
          materialName = materialName || poItem.materialName || "";
          unitOfMeasure = unitOfMeasure || poItem.unitOfMeasure || "";
        }
      }

      // Look up in Material master if still missing
      if (!materialCode || !materialName || !unitOfMeasure) {
        if (isValidObjectId(materialId)) {
          const matDoc = await Material.findById(materialId).lean();
          if (matDoc) {
            materialCode = materialCode || matDoc.materialCode || "";
            materialName = materialName || matDoc.materialName || "";
            unitOfMeasure =
              unitOfMeasure ||
              matDoc.unitOfMeasure ||
              matDoc.baseUnitOfMeasure ||
              "";
          }
        }
      }

      // Safe fallbacks to satisfy schema requirements
      if (!materialName) {
        materialName = item.itemName || "Material";
      }
      if (!materialCode) {
        materialCode = isValidObjectId(materialId)
          ? `MAT-${materialId.toString().slice(-6).toUpperCase()}`
          : "MAT-000";
      }
      if (!unitOfMeasure) {
        unitOfMeasure = "PCS";
      }

      // =====================================================
      // RETURN REPLACEMENT ITEM
      // =====================================================

      return {

        material:
          materialId,

        materialCode,

        materialName,

        unitOfMeasure,


        // Original quantity information
        receivedQuantity,

        originalAcceptedQuantity,

        rejectedQuantity,

        damagedQuantity,

        shortQuantity,


        // Final replacement decision
        replacementQuantity,

        replacementApprovedQuantity:
          0,


        // Replacement dispatch
        replacementDispatchedQuantity:
          0,


        // Replacement receipt
        replacementReceivedQuantity:
          0,


        // Replacement inspection
        replacementInspectedQuantity:
          0,

        replacementAcceptedQuantity:
          0,

        replacementRejectedQuantity:
          0,

        replacementDamagedQuantity:
          0,


        // Pending replacement
        replacementPendingQuantity:
          replacementQuantity,

        inspectionPendingQuantity:
          0,


        // Remarks
        rejectionReason:
          item.rejectionReason || "",

        rejectionRemarks:
          item.rejectionRemarks || "",

        remarks:
          item.remarks || "",
      };

    })
  );


  // =========================================================
  // CHECK ACTIVE REQUEST
  // =========================================================

  const existingRequest =
    await ReplacementRequest.findOne({

      originalDispatch:
        originalDispatchId,

      isDeleted:
        false,

      status: {
        $nin: [
          "Rejected",
          "Cancelled",
          "Completed",
        ],
      },

    });


  if (existingRequest) {

    throw new Error(
      "An active replacement request already exists for this dispatch."
    );

  }


  // =========================================================
  // GENERATE REQUEST NUMBER
  // =========================================================

  const requestNumber =
    await generateNextReplacementRequestNumber();


  // =========================================================
  // CREATE REQUEST
  // =========================================================

  const replacementRequest =
    new ReplacementRequest({

      requestNumber,

      purchaseOrder:
        purchaseOrderId,

      vendor:
        vendorId,

      originalDispatch:
        originalDispatchId,

      goodsReceipt:
        goodsReceiptId || purchaseOrder.goodsReceipt || null,

      qualityInspection:
        qualityInspectionId || null,

      items:
        replacementItems,

      requestedDate:
        new Date(),

      requiredReplacementDate:
        requiredReplacementDate || null,

      status:
        "Draft",

      reason,

      remarks,

      requestedBy,

      approval: {
        status:
          "Pending",
      },

      history: [],

    });


  // =========================================================
  // AUDIT HISTORY
  // =========================================================

  addHistory(
    replacementRequest,
    {
      action:
        "Replacement Request Created",

      previousStatus:
        "",

      newStatus:
        "Draft",

      performedBy:
        requestedBy,

      remarks:
        "Replacement request created as draft.",
    }
  );


  let saved = false;
  let attempts = 0;
  while (!saved && attempts < 5) {
    try {
      await replacementRequest.save();
      saved = true;
    } catch (saveError) {
      if (
        saveError.code === 11000 &&
        (saveError.keyPattern?.requestNumber ||
          saveError.message?.includes("requestNumber"))
      ) {
        attempts++;
        replacementRequest.requestNumber =
          await generateNextReplacementRequestNumber();
      } else {
        throw saveError;
      }
    }
  }

  if (qualityInspectionId && isValidObjectId(qualityInspectionId)) {
    try {
      await QualityInspection.findByIdAndUpdate(qualityInspectionId, {
        replacementRequest: replacementRequest._id,
      });
    } catch (linkError) {
      console.error(
        "Failed to link QualityInspection to ReplacementRequest:",
        linkError
      );
    }
  }


  return replacementRequest;
};


// =========================================================
// SUBMIT REPLACEMENT REQUEST FOR APPROVAL
// =========================================================

export const submitReplacementRequest =
  async (
    id,
    userId
  ) => {

    if (!isValidObjectId(id)) {

      throw new Error(
        "Invalid replacement request ID."
      );

    }


    if (!userId) {

      throw new Error(
        "User information is required."
      );

    }


    const request =
      await ReplacementRequest.findOne({
        _id: id,
        isDeleted: false,
      });


    if (!request) {

      throw new Error(
        "Replacement request not found."
      );

    }


    if (request.status !== "Draft") {

      throw new Error(
        `Only Draft replacement requests can be submitted. Current status: "${request.status}".`
      );

    }


    const previousStatus =
      request.status;


    request.status =
      "Pending Approval";


    request.approval.status =
      "Pending";


    request.updatedBy =
      userId;


    addHistory(
      request,
      {
        action:
          "Replacement Request Submitted",

        previousStatus,

        newStatus:
          "Pending Approval",

        performedBy:
          userId,

        remarks:
          "Replacement request submitted for approval.",
      }
    );


    await request.save();


    return request;

  };


// =========================================================
// APPROVE REPLACEMENT REQUEST
// =========================================================

export const approveReplacementRequest =
  async (
    id,
    userId,
    approvalRemarks = ""
  ) => {

    if (!isValidObjectId(id)) {

      throw new Error(
        "Invalid replacement request ID."
      );

    }


    if (!userId) {

      throw new Error(
        "Approver information is required."
      );

    }


    const request =
      await ReplacementRequest.findOne({
        _id: id,
        isDeleted: false,
      });


    if (!request) {

      throw new Error(
        "Replacement request not found."
      );

    }


    if (request.status !== "Pending Approval") {

      throw new Error(
        `Only Pending Approval requests can be approved. Current status: "${request.status}".`
      );

    }


    const previousStatus =
      request.status;


    request.status =
      "Approved";


    request.approval.status =
      "Approved";


    request.approval.approvedBy =
      userId;


    request.approval.approvedAt =
      new Date();


    request.approval.approvalRemarks =
      approvalRemarks;


    request.updatedBy =
      userId;


    request.items.forEach(
      (item) => {

        item.replacementApprovedQuantity =
          item.replacementQuantity;

        item.replacementPendingQuantity =
          item.replacementQuantity;

      }
    );


    addHistory(
      request,
      {
        action:
          "Replacement Request Approved",

        previousStatus,

        newStatus:
          "Approved",

        performedBy:
          userId,

        remarks:
          approvalRemarks ||
          "Replacement request approved.",
      }
    );


    await request.save();


    return request;

  };


// =========================================================
// REJECT REPLACEMENT REQUEST
// =========================================================

export const rejectReplacementRequest =
  async (
    id,
    userId,
    rejectionReason = ""
  ) => {

    if (!isValidObjectId(id)) {

      throw new Error(
        "Invalid replacement request ID."
      );

    }


    if (!userId) {

      throw new Error(
        "Approver information is required."
      );

    }


    if (
      !rejectionReason ||
      !rejectionReason.trim()
    ) {

      throw new Error(
        "Rejection reason is required."
      );

    }


    const request =
      await ReplacementRequest.findOne({
        _id: id,
        isDeleted: false,
      });


    if (!request) {

      throw new Error(
        "Replacement request not found."
      );

    }


    if (request.status !== "Pending Approval") {

      throw new Error(
        `Only Pending Approval requests can be rejected. Current status: "${request.status}".`
      );

    }


    const previousStatus =
      request.status;


    request.status =
      "Rejected";


    request.approval.status =
      "Rejected";


    request.approval.rejectedBy =
      userId;


    request.approval.rejectedAt =
      new Date();


    request.approval.rejectionReason =
      rejectionReason.trim();


    request.updatedBy =
      userId;


    addHistory(
      request,
      {
        action:
          "Replacement Request Rejected",

        previousStatus,

        newStatus:
          "Rejected",

        performedBy:
          userId,

        remarks:
          rejectionReason.trim(),
      }
    );


    await request.save();


    return request;

  };


// =========================================================
// GET ORGANIZATION REPLACEMENT REQUESTS
// =========================================================

export const getOrganizationReplacementRequests =
  async ({
    page = 1,
    limit = 10,
    search = "",
    status = "",
    vendor = "",
  } = {}) => {

    const pageNumber =
      Math.max(
        Number(page) || 1,
        1
      );


    const limitNumber =
      Math.max(
        Number(limit) || 10,
        1
      );


    const skip =
      (pageNumber - 1) *
      limitNumber;


    const query = {
      isDeleted: false,
    };


    if (status) {

      query.status =
        status;

    }


    if (vendor) {

      if (!isValidObjectId(vendor)) {

        throw new Error(
          "Invalid vendor ID."
        );

      }

      query.vendor =
        vendor;

    }


    if (search?.trim()) {

      const searchValue =
        search.trim();

      query.requestNumber = {

        $regex:
          searchValue,

        $options:
          "i",

      };

    }


    const [
      requests,
      total,
    ] = await Promise.all([

      ReplacementRequest
        .find(query)

        .populate(
          "purchaseOrder",
          "poNumber expectedDeliveryDate status"
        )

        .populate(
          "vendor",
          "vendorCode vendorName email phone"
        )

        .populate(
          "originalDispatch",
          "dispatchNumber dispatchDate expectedDeliveryDate status"
        )

        .populate(
          "replacementDispatch",
          "dispatchNumber dispatchDate expectedDeliveryDate status"
        )

        .sort({
          createdAt: -1,
        })

        .skip(skip)

        .limit(limitNumber)

        .lean(),

      ReplacementRequest.countDocuments(
        query
      ),

    ]);


    return {

      replacementRequests:
        requests,

      total,

      page:
        pageNumber,

      pages:
        Math.ceil(
          total / limitNumber
        ),

    };

  };


// =========================================================
// GET ORGANIZATION REPLACEMENT REQUEST BY ID
// =========================================================

export const getOrganizationReplacementRequestById =
  async (
    id
  ) => {

    if (!isValidObjectId(id)) {

      throw new Error(
        "Invalid replacement request ID."
      );

    }


    const request =
      await ReplacementRequest

        .findOne({

          _id:
            id,

          isDeleted:
            false,

        })

        .populate(
          "purchaseOrder"
        )

        .populate(
          "vendor"
        )

        .populate(
          "originalDispatch"
        )

        .populate(
          "replacementDispatch"
        )

        .populate(
          "requestedBy",
          "name email role"
        )

        .populate(
          "updatedBy",
          "name email role"
        )

        .lean();


    if (!request) {

      throw new Error(
        "Replacement request not found."
      );

    }


    return request;

  };


// =========================================================
// GET VENDOR REPLACEMENT REQUESTS
// =========================================================

export const getVendorReplacementRequests =
  async ({
    vendorId,
    page = 1,
    limit = 10,
    search = "",
    status = "",
  }) => {

    if (
      !vendorId ||
      !isValidObjectId(vendorId)
    ) {

      throw new Error(
        "Invalid vendor ID."
      );

    }


    const pageNumber =
      Math.max(
        Number(page) || 1,
        1
      );


    const limitNumber =
      Math.max(
        Number(limit) || 10,
        1
      );


    const skip =
      (pageNumber - 1) *
      limitNumber;


    const query = {

      vendor:
        vendorId,

      isDeleted:
        false,

    };


    if (status) {

      query.status =
        status;

    }


    if (search?.trim()) {

      const searchValue =
        search.trim();

      query.$or = [

        {
          requestNumber: {

            $regex:
              searchValue,

            $options:
              "i",

          },

        },

      ];

    }


    const [
      requests,
      total,
    ] = await Promise.all([

      ReplacementRequest
        .find(query)

        .populate(
          "purchaseOrder",
          "poNumber expectedDeliveryDate status"
        )

        .populate(
          "originalDispatch",
          "dispatchNumber dispatchDate expectedDeliveryDate status"
        )

        .populate(
          "replacementDispatch",
          "dispatchNumber dispatchDate expectedDeliveryDate status"
        )

        .sort({
          createdAt: -1,
        })

        .skip(skip)

        .limit(limitNumber)

        .lean(),

      ReplacementRequest.countDocuments(
        query
      ),

    ]);


    return {

      replacementRequests:
        requests,

      total,

      page:
        pageNumber,

      pages:
        Math.ceil(
          total / limitNumber
        ),

    };

  };


// =========================================================
// GET VENDOR REPLACEMENT REQUEST BY ID
// =========================================================

export const getVendorReplacementRequestById =
  async (
    id,
    vendorId
  ) => {

    if (!isValidObjectId(id)) {

      throw new Error(
        "Invalid replacement request ID."
      );

    }


    if (
      !vendorId ||
      !isValidObjectId(vendorId)
    ) {

      throw new Error(
        "Invalid vendor ID."
      );

    }


    const request =
      await ReplacementRequest
        .findOne({

          _id:
            id,

          vendor:
            vendorId,

          isDeleted:
            false,

        })

        .populate(
          "purchaseOrder"
        )

        .populate(
          "originalDispatch"
        )

        .populate(
          "replacementDispatch"
        )

        .lean();


    if (!request) {

      throw new Error(
        "Replacement request not found."
      );

    }


    return request;

  };


// =========================================================
// GET REPLACEMENT DISPATCH HISTORY
// =========================================================

export const getReplacementDispatchHistory =
  async (
    replacementRequestId,
    vendorId = null
  ) => {

    if (
      !isValidObjectId(
        replacementRequestId
      )
    ) {

      throw new Error(
        "Invalid replacement request ID."
      );

    }


    if (
      vendorId &&
      !isValidObjectId(vendorId)
    ) {

      throw new Error(
        "Invalid vendor ID."
      );

    }


    const requestQuery = {

      _id:
        replacementRequestId,

      isDeleted:
        false,

    };


    if (vendorId) {

      requestQuery.vendor =
        vendorId;

    }


    const replacementRequest =
      await ReplacementRequest.findOne(
        requestQuery
      ).lean();


    if (!replacementRequest) {

      throw new Error(
        "Replacement request not found."
      );

    }


    const dispatchQuery = {

      "items.replacementRequest":
        replacementRequest._id,

      isDeleted:
        false,

    };


    if (vendorId) {

      dispatchQuery.vendor =
        vendorId;

    }


    const dispatches =
      await Dispatch.find(
        dispatchQuery
      )

        .populate(
          "purchaseOrder",
          "poNumber status expectedDeliveryDate"
        )

        .populate(
          "vendor",
          "vendorCode vendorName email"
        )

        .populate(
          "items.material",
          "materialCode materialName unitOfMeasure"
        )

        .sort({
          dispatchDate: 1,
          createdAt: 1,
        })

        .lean();


    const history =
      dispatches.map(
        (dispatch) => {

          const replacementItems =
            (dispatch.items || [])
              .filter(
                (item) =>
                  item.isReplacement &&
                  item.replacementRequest &&
                  item.replacementRequest.toString() ===
                    replacementRequest._id.toString()
              );


          const totalQuantity =
            replacementItems.reduce(
              (
                total,
                item
              ) =>
                total +
                Number(
                  item.dispatchQuantity || 0
                ),
              0
            );


          return {

            dispatchId:
              dispatch._id,

            dispatchNumber:
              dispatch.dispatchNumber,

            dispatchDate:
              dispatch.dispatchDate,

            expectedDeliveryDate:
              dispatch.expectedDeliveryDate,

            dispatchType:
              dispatch.dispatchType,

            status:
              dispatch.status,

            transporterName:
              dispatch.transporterName,

            vehicleNumber:
              dispatch.vehicleNumber,

            driverName:
              dispatch.driverName,

            driverContact:
              dispatch.driverContact,

            shippingMethod:
              dispatch.shippingMethod,

            lrNumber:
              dispatch.lrNumber,

            trackingNumber:
              dispatch.trackingNumber,

            awbNumber:
              dispatch.awbNumber,

            consignmentNumber:
              dispatch.consignmentNumber,

            packageCount:
              dispatch.packageCount,

            totalWeight:
              dispatch.totalWeight,

            weightUnit:
              dispatch.weightUnit,

            packageType:
              dispatch.packageType,

            remarks:
              dispatch.remarks,

            quantity:
              totalQuantity,

            items:
              replacementItems,

            trackingHistory:
              dispatch.trackingHistory || [],

            documents:
              dispatch.documents || [],

            createdAt:
              dispatch.createdAt,

            updatedAt:
              dispatch.updatedAt,

          };

        }
      );


    const approvedQuantity =
      replacementRequest.items.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.replacementApprovedQuantity ||
            item.replacementQuantity ||
            0
          ),
        0
      );


    const dispatchedQuantity =
      replacementRequest.items.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.replacementDispatchedQuantity ||
            0
          ),
        0
      );


    const receivedQuantity =
      replacementRequest.items.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.replacementReceivedQuantity ||
            0
          ),
        0
      );


    const acceptedQuantity =
      replacementRequest.items.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.replacementAcceptedQuantity ||
            0
          ),
        0
      );


    const rejectedQuantity =
      replacementRequest.items.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.replacementRejectedQuantity ||
            0
          ),
        0
      );


    const pendingQuantity =
      replacementRequest.items.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.replacementPendingQuantity ||
            Math.max(
              Number(
                item.replacementApprovedQuantity ||
                item.replacementQuantity ||
                0
              ) -
              Number(
                item.replacementDispatchedQuantity ||
                0
              ),
              0
            )
          ),
        0
      );


    return {

      replacementRequestId:
        replacementRequest._id,

      requestNumber:
        replacementRequest.requestNumber,

      status:
        replacementRequest.status,

      purchaseOrder:
        replacementRequest.purchaseOrder,

      vendor:
        replacementRequest.vendor,

      originalDispatch:
        replacementRequest.originalDispatch,

      requiredReplacementDate:
        replacementRequest.requiredReplacementDate,

      approvedQuantity,

      dispatchedQuantity,

      receivedQuantity,

      acceptedQuantity,

      rejectedQuantity,

      pendingQuantity,

      dispatchCount:
        history.length,

      dispatches:
        history,

      auditHistory:
        replacementRequest.dispatchHistory || [],

      requestHistory:
        replacementRequest.history || [],

    };

  };


// =========================================================
// VENDOR ACCEPT REPLACEMENT REQUEST
// =========================================================

export const acceptReplacementRequest =
  async (
    id,
    vendorId,
    vendorRemarks = ""
  ) => {

    const request =
      await ReplacementRequest.findOne({

        _id:
          id,

        vendor:
          vendorId,

        isDeleted:
          false,

      });


    if (!request) {

      throw new Error(
        "Replacement request not found."
      );

    }


    if (request.status !== "Approved") {

      throw new Error(
        `Replacement request cannot be accepted from "${request.status}" status.`
      );

    }


    const previousStatus =
      request.status;


    request.status =
      "Vendor Accepted";


    request.vendorResponseDate =
      new Date();


    request.vendorRemarks =
      vendorRemarks;


    request.updatedBy =
      vendorId;


    addHistory(
      request,
      {

        action:
          "Vendor Accepted Replacement Request",

        previousStatus,

        newStatus:
          "Vendor Accepted",

        performedBy:
          null,

        remarks:
          vendorRemarks ||
          "Vendor accepted the replacement request.",

      }
    );


    await request.save();


    return request;

  };


// =========================================================
// LINK REPLACEMENT DISPATCH
// =========================================================

// =========================================================
// LINK REPLACEMENT DISPATCH
// =========================================================
//
// Supports MULTIPLE replacement dispatches.
//
// Example:
//
// Approved Replacement = 10
//
// Dispatch 1 = 6
// Dispatch 2 = 4
//
// Result:
//
// replacementDispatchedQuantity = 10
// replacementPendingQuantity     = 0
//
// IMPORTANT:
// - dispatchHistory stores every replacement dispatch.
// - replacementDispatch stores the latest/primary dispatch.
// - Quantities are maintained PER MATERIAL.
// =========================================================

export const linkReplacementDispatch =
  async (
    replacementRequestId,
    replacementDispatchId,
    vendorId
  ) => {

    // =======================================================
    // VALIDATE IDS
    // =======================================================

    if (
      !isValidObjectId(
        replacementRequestId
      )
    ) {
      throw new Error(
        "Invalid replacement request ID."
      );
    }

    if (
      !isValidObjectId(
        replacementDispatchId
      )
    ) {
      throw new Error(
        "Invalid replacement dispatch ID."
      );
    }

    if (
      !vendorId ||
      !isValidObjectId(vendorId)
    ) {
      throw new Error(
        "Invalid vendor ID."
      );
    }


    // =======================================================
    // FIND REPLACEMENT REQUEST
    // =======================================================

    const request =
      await ReplacementRequest.findOne({

        _id:
          replacementRequestId,

        vendor:
          vendorId,

        isDeleted:
          false,

      });

    if (!request) {
      throw new Error(
        "Replacement request not found."
      );
    }


    // =======================================================
    // VALID STATUS
    // =======================================================

    if (
      ![
        "Vendor Accepted",
        "Approved",
        "Partially Dispatched",
        "Replacement Dispatched",
        "Replacement In Transit",
      ].includes(
        request.status
      )
    ) {
      throw new Error(
        `Replacement dispatch cannot be linked from "${request.status}" status.`
      );
    }


    // =======================================================
    // FIND DISPATCH
    // =======================================================

    const dispatch =
      await Dispatch.findOne({

        _id:
          replacementDispatchId,

        vendor:
          vendorId,

        isDeleted:
          false,

      });

    if (!dispatch) {
      throw new Error(
        "Replacement dispatch not found."
      );
    }


    // =======================================================
    // VERIFY THIS IS A REPLACEMENT DISPATCH
    // =======================================================

    if (
      dispatch.dispatchType !==
      "Replacement"
    ) {
      throw new Error(
        "Selected dispatch is not a Replacement dispatch."
      );
    }


    if (
      !Array.isArray(
        dispatch.items
      ) ||
      dispatch.items.length === 0
    ) {
      throw new Error(
        "Replacement dispatch does not contain any items."
      );
    }


    // =======================================================
    // FIND ITEMS BELONGING TO THIS REQUEST
    // =======================================================

    const replacementItems =
      dispatch.items.filter(
        (item) =>
          item.isReplacement === true &&
          item.replacementRequest &&
          item.replacementRequest.toString() ===
            request._id.toString()
      );


    if (
      replacementItems.length === 0
    ) {
      throw new Error(
        "This dispatch does not contain items belonging to the selected Replacement Request."
      );
    }


    // =======================================================
    // PREVENT SAME DISPATCH FROM BEING LINKED TWICE
    // =======================================================

    const alreadyLinked =
      Array.isArray(
        request.dispatchHistory
      ) &&
      request.dispatchHistory.some(
        (history) =>
          history.dispatch &&
          history.dispatch.toString() ===
            dispatch._id.toString()
      );

    if (alreadyLinked) {
      throw new Error(
        "This replacement dispatch is already linked to the Replacement Request."
      );
    }


    // =======================================================
    // PROCESS EACH DISPATCH ITEM
    // =======================================================

    for (
      const dispatchItem
      of replacementItems
    ) {

      const materialId =
        dispatchItem.material?.toString();

      if (!materialId) {
        throw new Error(
          "Replacement dispatch item is missing material information."
        );
      }


      const dispatchQuantity =
        Number(
          dispatchItem.dispatchQuantity ||
          0
        );

      if (
        !Number.isFinite(
          dispatchQuantity
        ) ||
        dispatchQuantity <= 0
      ) {
        throw new Error(
          `Invalid replacement dispatch quantity for ${dispatchItem.materialName || materialId}.`
        );
      }


      // =====================================================
      // FIND CORRESPONDING REQUEST ITEM
      // =====================================================

      const requestItem =
        request.items.find(
          (item) =>
            item.material &&
            item.material.toString() ===
              materialId
        );


      if (!requestItem) {
        throw new Error(
          `Material ${dispatchItem.materialName || materialId} does not belong to this Replacement Request.`
        );
      }


      // =====================================================
      // APPROVED QUANTITY
      // =====================================================

      const approvedQuantity =
        Number(
          requestItem.replacementApprovedQuantity ||
          requestItem.replacementQuantity ||
          0
        );


      // =====================================================
      // ALREADY DISPATCHED
      // =====================================================

      const alreadyDispatchedQuantity =
        Number(
          requestItem.replacementDispatchedQuantity ||
          0
        );


      // =====================================================
      // REMAINING DISPATCHABLE
      // =====================================================

      const remainingDispatchableQuantity =
        Math.max(
          approvedQuantity -
          alreadyDispatchedQuantity,
          0
        );


      // =====================================================
      // VALIDATE QUANTITY
      // =====================================================

      if (
        dispatchQuantity >
        remainingDispatchableQuantity
      ) {
        throw new Error(
          `${requestItem.materialName || materialId}: dispatch quantity ${dispatchQuantity} exceeds remaining approved replacement quantity ${remainingDispatchableQuantity}.`
        );
      }


      // =====================================================
      // UPDATE DISPATCHED QUANTITY
      // =====================================================

      requestItem.replacementDispatchedQuantity =
        alreadyDispatchedQuantity +
        dispatchQuantity;


      // =====================================================
      // UPDATE PENDING DISPATCH QUANTITY
      // =====================================================

      requestItem.replacementPendingQuantity =
        Math.max(
          approvedQuantity -
          requestItem.replacementDispatchedQuantity,
          0
        );
    }


    // =======================================================
    // ADD DISPATCH HISTORY
    // =======================================================

    if (
      !Array.isArray(
        request.dispatchHistory
      )
    ) {
      request.dispatchHistory = [];
    }


    const totalDispatchQuantity =
      replacementItems.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.dispatchQuantity ||
            0
          ),
        0
      );


    request.dispatchHistory.push({

      dispatch:
        dispatch._id,

      dispatchNumber:
        dispatch.dispatchNumber ||
        "",

      dispatchDate:
        dispatch.dispatchDate ||
        null,

      quantity:
        totalDispatchQuantity,

      addedBy:
        null,

      addedAt:
        new Date(),

      remarks:
        `Replacement dispatch ${dispatch.dispatchNumber || dispatch._id} linked.`,

    });


    // =======================================================
    // PRIMARY / LATEST REPLACEMENT DISPATCH
    // =======================================================

    request.replacementDispatch =
      dispatch._id;


    // =======================================================
    // CALCULATE TOTAL APPROVED
    // =======================================================

    const totalApproved =
      request.items.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.replacementApprovedQuantity ||
            item.replacementQuantity ||
            0
          ),
        0
      );


    // =======================================================
    // CALCULATE TOTAL DISPATCHED
    // =======================================================

    const totalDispatched =
      request.items.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.replacementDispatchedQuantity ||
            0
          ),
        0
      );


    // =======================================================
    // CALCULATE TOTAL PENDING
    // =======================================================

    const totalPending =
      request.items.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.replacementPendingQuantity ||
            0
          ),
        0
      );


    // =======================================================
    // UPDATE STATUS
    // =======================================================

    const previousStatus =
      request.status;


    if (
      totalDispatched >=
      totalApproved
    ) {

      request.status =
        "Fully Dispatched";

    } else {

      request.status =
        "Partially Dispatched";
    }


    // =======================================================
    // UPDATE AUDIT USER
    // =======================================================

    request.updatedBy =
      vendorId;


    // =======================================================
    // ADD WORKFLOW HISTORY
    // =======================================================

    addHistory(
      request,
      {
        action:
          "Replacement Dispatch Linked",

        previousStatus,

        newStatus:
          request.status,

        performedBy:
          null,

        remarks:
          `Replacement dispatch ${dispatch.dispatchNumber || dispatch._id} linked. Dispatched ${totalDispatchQuantity}. Total dispatched ${totalDispatched}/${totalApproved}. Pending ${totalPending}.`,
      }
    );


    // =======================================================
    // SAVE
    // =======================================================

    await request.save();


    // =======================================================
    // RETURN
    // =======================================================

    return request;
  };

// =========================================================
// PROCESS REPLACEMENT QUALITY INSPECTION OUTCOME
// =========================================================
//
// Called by Quality Inspection after a replacement GRN
// has been completely inspected.
//
// Workflow:
//
// Replacement GRN
//       ↓
// Quality Inspection
//       ↓
// This function
//       ↓
// ┌──────────────────────────────┐
// │ Fully Accepted               │
// │        ↓                     │
// │ Replacement Completed        │
// └──────────────────────────────┘
//
// OR
//
// ┌──────────────────────────────┐
// │ Rejected / Damaged           │
// │        ↓                     │
// │ Replacement Required         │
// └──────────────────────────────┘
//
// IMPORTANT:
// - Does NOT modify original PO quantities.
// - Does NOT modify original dispatch quantities.
// - Replacement quantities remain separate.
// - Supports multiple replacement dispatches.
// =========================================================

export const processReplacementQualityInspectionOutcome =
  async (
    replacementRequestId,
    inspection,
    userId
  ) => {

    // =======================================================
    // VALIDATE REQUEST ID
    // =======================================================

    if (
      !isValidObjectId(
        replacementRequestId
      )
    ) {

      throw new Error(
        "Invalid replacement request ID."
      );

    }


    if (!inspection) {

      throw new Error(
        "Quality Inspection information is required."
      );

    }


    if (!userId) {

      throw new Error(
        "User information is required."
      );

    }


    // =======================================================
    // FIND REQUEST
    // =======================================================

    const request =
      await ReplacementRequest.findOne({

        _id:
          replacementRequestId,

        isDeleted:
          false,

      });


    if (!request) {

      throw new Error(
        "Replacement request not found."
      );

    }


    // =======================================================
    // PROCESS INSPECTION ITEMS
    // =======================================================

    for (
      const inspectionItem
      of inspection.items || []
    ) {

      if (
        !inspectionItem.material
      ) {
        continue;
      }


      const materialId =
        inspectionItem.material.toString();


      const requestItem =
        request.items.find(
          (item) =>
            item.material &&
            item.material.toString() ===
              materialId
        );


      if (!requestItem) {

        throw new Error(
          `Inspection material ${inspectionItem.materialName || materialId} does not belong to this Replacement Request.`
        );

      }


      // =====================================================
      // QUANTITIES
      // =====================================================

      const inspectedQuantity =
        Number(
          inspectionItem.inspectionQuantity ||
          0
        );


      const acceptedQuantity =
        Number(
          inspectionItem.acceptedQuantity ||
          0
        );


      const rejectedQuantity =
        Number(
          inspectionItem.rejectedQuantity ||
          0
        );


      const damagedQuantity =
        Number(
          inspectionItem.damagedQuantity ||
          0
        );


      // =====================================================
      // VALIDATE INSPECTION BREAKDOWN
      // =====================================================

      if (
        inspectedQuantity < 0 ||
        acceptedQuantity < 0 ||
        rejectedQuantity < 0 ||
        damagedQuantity < 0
      ) {

        throw new Error(
          `Invalid inspection quantity for ${inspectionItem.materialName || materialId}.`
        );

      }


      if (
        acceptedQuantity +
        rejectedQuantity +
        damagedQuantity >
        inspectedQuantity
      ) {

        throw new Error(
          `Accepted, rejected and damaged quantity cannot exceed inspected quantity for ${inspectionItem.materialName || materialId}.`
        );

      }


      // =====================================================
      // UPDATE CUMULATIVE INSPECTION QUANTITIES
      // =====================================================

      requestItem.replacementInspectedQuantity =
        Number(
          requestItem.replacementInspectedQuantity ||
          0
        ) +
        inspectedQuantity;


      requestItem.replacementAcceptedQuantity =
        Number(
          requestItem.replacementAcceptedQuantity ||
          0
        ) +
        acceptedQuantity;


      requestItem.replacementRejectedQuantity =
        Number(
          requestItem.replacementRejectedQuantity ||
          0
        ) +
        rejectedQuantity;


      requestItem.replacementDamagedQuantity =
        Number(
          requestItem.replacementDamagedQuantity ||
          0
        ) +
        damagedQuantity;


      // =====================================================
      // REDUCE INSPECTION PENDING
      // =====================================================

      requestItem.inspectionPendingQuantity =
        Math.max(
          Number(
            requestItem.inspectionPendingQuantity ||
            0
          ) -
          inspectedQuantity,
          0
        );

    }


    // =======================================================
    // CALCULATE REQUEST TOTALS
    // =======================================================

    const totals =
      request.items.reduce(
        (
          result,
          item
        ) => {

          result.approved +=
            Number(
              item.replacementApprovedQuantity ||
              item.replacementQuantity ||
              0
            );

          result.dispatched +=
            Number(
              item.replacementDispatchedQuantity ||
              0
            );

          result.received +=
            Number(
              item.replacementReceivedQuantity ||
              0
            );

          result.inspected +=
            Number(
              item.replacementInspectedQuantity ||
              0
            );

          result.accepted +=
            Number(
              item.replacementAcceptedQuantity ||
              0
            );

          result.rejected +=
            Number(
              item.replacementRejectedQuantity ||
              0
            );

          result.damaged +=
            Number(
              item.replacementDamagedQuantity ||
              0
            );

          result.pendingDispatch +=
            Number(
              item.replacementPendingQuantity ||
              0
            );

          result.pendingInspection +=
            Number(
              item.inspectionPendingQuantity ||
              0
            );

          return result;

        },
        {
          approved: 0,
          dispatched: 0,
          received: 0,
          inspected: 0,
          accepted: 0,
          rejected: 0,
          damaged: 0,
          pendingDispatch: 0,
          pendingInspection: 0,
        }
      );


    // =======================================================
    // UPDATE AUDIT
    // =======================================================

    request.updatedBy =
      userId;


    const previousStatus =
      request.status;


    // =======================================================
    // STILL WAITING FOR DELIVERY
    // =======================================================

    if (
      totals.pendingDispatch > 0
    ) {

      request.status =
        "Partially Dispatched";

    }


    // =======================================================
    // WAITING FOR INSPECTION
    // =======================================================

    else if (
      totals.pendingInspection > 0
    ) {

      request.status =
        "Inspection Pending";

    }


    // =======================================================
    // FULLY INSPECTED
    // =======================================================

    else {

      const failedQuantity =
        totals.rejected +
        totals.damaged;


      // =====================================================
      // COMPLETE
      // =====================================================

      if (
        failedQuantity === 0 &&
        totals.accepted >=
          totals.received &&
        totals.received >=
          totals.approved
      ) {

        request.status =
          "Completed";

        request.completedDate =
          new Date();

        request.completion = {

          completedBy:
            userId,

          completedDate:
            new Date(),

          completionRemarks:
            "Replacement quantity fully received and accepted after Quality Inspection.",

        };

      }


      // =====================================================
      // REPLACEMENT REQUIRED
      // =====================================================

      else if (
        failedQuantity > 0
      ) {

        request.status =
          "Replacement Required";

      }


      // =====================================================
      // INSPECTED BUT NOT YET COMPLETE
      // =====================================================

      else {

        request.status =
          "Inspection Completed";

      }

    }


    // =======================================================
    // ADD HISTORY
    // =======================================================

    addHistory(
      request,
      {

        action:
          "Replacement Quality Inspection Completed",

        previousStatus,

        newStatus:
          request.status,

        performedBy:
          userId,

        remarks:
          `Replacement inspection completed. Received: ${totals.received}, Inspected: ${totals.inspected}, Accepted: ${totals.accepted}, Rejected: ${totals.rejected}, Damaged: ${totals.damaged}.`,

      }
    );


    // =======================================================
    // SAVE
    // =======================================================

    await request.save();


    // =======================================================
    // RETURN
    // =======================================================

    return {

      replacementRequest:
        request,

      totals,

      status:
        request.status,

    };

  };


// =========================================================
// CREATE RE-REPLACEMENT REQUEST
// =========================================================
//
// Used when replacement material itself fails Quality
// Inspection.
//
// Example:
//
// Replacement Request #1
// Approved      = 10
// Received     = 10
// Accepted     = 8
// Rejected     = 2
//
// Status:
// "Replacement Required"
//
// Then create:
//
// Replacement Request #2
// Replacement Quantity = 2
// Cycle = 2
// Parent = Request #1
//
// IMPORTANT:
// - Does NOT modify the original PO quantity.
// - Does NOT modify the previous replacement request.
// - Preserves complete replacement history.
// - Allows partial re-replacement.
// =========================================================

export const createReReplacementRequest = async ({
  previousReplacementRequestId,
  items,
  reason = "",
  remarks = "",
  requiredReplacementDate = null,
  requestedBy,
}) => {

  // =======================================================
  // VALIDATE INPUT
  // =======================================================

  if (!requestedBy) {
    throw new Error(
      "Requester information is required."
    );
  }

  if (
    !isValidObjectId(
      previousReplacementRequestId
    )
  ) {
    throw new Error(
      "Invalid previous Replacement Request ID."
    );
  }

  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    throw new Error(
      "At least one re-replacement item is required."
    );
  }


  // =======================================================
  // FIND PREVIOUS REQUEST
  // =======================================================

  const previousRequest =
    await ReplacementRequest.findOne({

      _id:
        previousReplacementRequestId,

      isDeleted:
        false,

    });


  if (!previousRequest) {
    throw new Error(
      "Previous Replacement Request not found."
    );
  }


  // =======================================================
  // PREVIOUS REQUEST MUST REQUIRE REPLACEMENT
  // =======================================================

  if (
    previousRequest.status !==
    "Replacement Required"
  ) {
    throw new Error(
      `Re-replacement can only be created when the previous Replacement Request is in "Replacement Required" status. Current status: "${previousRequest.status}".`
    );
  }


  // =======================================================
  // FIND PURCHASE ORDER
  // =======================================================

  const purchaseOrder =
    await PurchaseOrder.findOne({

      _id:
        previousRequest.purchaseOrder,

      isDeleted:
        false,

    });


  if (!purchaseOrder) {
    throw new Error(
      "Purchase Order not found."
    );
  }


  // =======================================================
  // BUILD RE-REPLACEMENT ITEMS
  // =======================================================

  const reReplacementItems =
    items.map(
      (item, index) => {

        if (!item.material) {
          throw new Error(
            `Material is required for re-replacement item ${index + 1}.`
          );
        }


        const requestItem =
          previousRequest.items.find(
            (previousItem) =>
              previousItem.material &&
              previousItem.material.toString() ===
                item.material.toString()
          );


        if (!requestItem) {
          throw new Error(
            `Material ${item.material} does not belong to the previous Replacement Request.`
          );
        }


        // =================================================
        // FAILED QUANTITY
        // =================================================

        const failedQuantity =
          Number(
            requestItem.replacementRejectedQuantity || 0
          ) +
          Number(
            requestItem.replacementDamagedQuantity || 0
          );


        if (
          failedQuantity <= 0
        ) {
          throw new Error(
            `${requestItem.materialName || item.material}: no rejected or damaged replacement quantity is available for re-replacement.`
          );
        }


        // =================================================
        // REQUESTED RE-REPLACEMENT QUANTITY
        // =================================================

        const replacementQuantity =
          Number(
            item.replacementQuantity ??
            failedQuantity
          );


        if (
          !Number.isFinite(
            replacementQuantity
          ) ||
          replacementQuantity <= 0
        ) {
          throw new Error(
            `Re-replacement quantity must be greater than zero for ${requestItem.materialName || item.material}.`
          );
        }


        // =================================================
        // CANNOT EXCEED FAILED QUANTITY
        // =================================================

        if (
          replacementQuantity >
          failedQuantity
        ) {
          throw new Error(
            `${requestItem.materialName || item.material}: re-replacement quantity ${replacementQuantity} cannot exceed failed quantity ${failedQuantity}.`
          );
        }


        // =================================================
        // CREATE NEW ITEM
        // =================================================

        return {

          material:
            requestItem.material,

          materialCode:
            requestItem.materialCode || "",

          materialName:
            requestItem.materialName || "",

          unitOfMeasure:
            requestItem.unitOfMeasure || "",


          receivedQuantity:
            0,

          originalAcceptedQuantity:
            0,

          rejectedQuantity:
            0,

          damagedQuantity:
            0,

          shortQuantity:
            0,


          replacementQuantity,


          replacementApprovedQuantity:
            0,

          replacementDispatchedQuantity:
            0,

          replacementReceivedQuantity:
            0,

          replacementInspectedQuantity:
            0,

          replacementAcceptedQuantity:
            0,

          replacementRejectedQuantity:
            0,

          replacementDamagedQuantity:
            0,


          replacementPendingQuantity:
            replacementQuantity,

          inspectionPendingQuantity:
            0,


          rejectionReason:
            item.rejectionReason ||
            "Replacement material failed Quality Inspection.",

          rejectionRemarks:
            item.rejectionRemarks || "",

          remarks:
            item.remarks || "",

        };

      }
    );


  // =======================================================
  // CALCULATE NEXT CYCLE
  // =======================================================

  const previousCycle =
    Number(
      previousRequest.replacementCycle || 1
    );


  const nextCycle =
    previousCycle + 1;


  // =======================================================
  // GENERATE REQUEST NUMBER
  // =======================================================

  const requestNumber =
    await generateNextReplacementRequestNumber();


  // =======================================================
  // CREATE NEW REQUEST
  // =======================================================

  const replacementRequest =
    new ReplacementRequest({

      requestNumber,

      purchaseOrder:
        previousRequest.purchaseOrder,

      vendor:
        previousRequest.vendor,

      originalDispatch:
        previousRequest.originalDispatch,

      parentReplacementRequest:
        previousRequest._id,

      replacementCycle:
        nextCycle,

      items:
        reReplacementItems,

      requestedDate:
        new Date(),

      requiredReplacementDate:
        requiredReplacementDate || null,

      status:
        "Draft",

      reason:
        reason ||
        "Re-replacement required because replacement material failed Quality Inspection.",

      remarks,

      requestedBy,

      approval: {
        status:
          "Pending",
      },

      history: [],

    });


  // =======================================================
  // ADD HISTORY
  // =======================================================

  addHistory(
    replacementRequest,
    {

      action:
        "Re-Replacement Request Created",

      previousStatus:
        "",

      newStatus:
        "Draft",

      performedBy:
        requestedBy,

      remarks:
        `Re-replacement request created from ${previousRequest.requestNumber}. Replacement cycle ${nextCycle}.`,

    }
  );


  // =======================================================
  // SAVE
  // =======================================================

  let reSaved = false;
  let reAttempts = 0;
  while (!reSaved && reAttempts < 5) {
    try {
      await replacementRequest.save();
      reSaved = true;
    } catch (saveError) {
      if (
        saveError.code === 11000 &&
        (saveError.keyPattern?.requestNumber ||
          saveError.message?.includes("requestNumber"))
      ) {
        reAttempts++;
        replacementRequest.requestNumber =
          await generateNextReplacementRequestNumber();
      } else {
        throw saveError;
      }
    }
  }


  // =======================================================
  // RETURN
  // =======================================================

  return replacementRequest;

};
// =========================================================
// COMPLETE REPLACEMENT REQUEST
// =========================================================

export const completeReplacementRequest =
  async (
    id,
    vendorId,
    completionRemarks = ""
  ) => {

    const request =
      await ReplacementRequest.findOne({

        _id:
          id,

        vendor:
          vendorId,

        isDeleted:
          false,

      });


    if (!request) {

      throw new Error(
        "Replacement request not found."
      );

    }


    throw new Error(
      "Direct vendor completion is disabled. Replacement must be received and quality inspected before completion."
    );

  };