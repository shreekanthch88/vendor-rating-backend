import { createForRole } from "./notificationService.js";
import mongoose from "mongoose";

import Dispatch from "../models/Dispatch.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import ReplacementRequest from "../models/ReplacementRequest.js";

/**
 * ==========================================================
 * DISPATCH NUMBER GENERATOR
 * ==========================================================
 *
 * Generates the next GLOBAL dispatch number.
 *
 * IMPORTANT:
 * Do NOT use createdAt to determine the last dispatch number.
 *
 * Example:
 *
 * DSP000001
 * DSP000002
 * DSP000003
 * ...
 *
 * Replacement dispatches use the same sequence:
 *
 * DSP000010
 * DSP000011
 * ...
 *
 * ==========================================================
 */

const generateDispatchNumber = async () => {

  const lastDispatch =
    await Dispatch.findOne({
      dispatchNumber: {
        $regex: /^DSP\d+$/,
      },
    })
      .sort({
        dispatchNumber: -1,
      })
      .select("dispatchNumber")
      .lean();

  if (!lastDispatch) {
    return "DSP000001";
  }

  const lastNumber =
    parseInt(
      String(
        lastDispatch.dispatchNumber
      ).replace("DSP", ""),
      10
    );

  if (
    !Number.isFinite(lastNumber)
  ) {
    return "DSP000001";
  }

  return `DSP${String(
    lastNumber + 1
  ).padStart(6, "0")}`;
};


/**
 * ==========================================================
 * GET PURCHASE ORDER
 * ==========================================================
 */

const getVendorPurchaseOrder = async (
  purchaseOrderId,
  vendorId
) => {

  let normalizedPurchaseOrderId =
    purchaseOrderId;

  if (
    purchaseOrderId &&
    typeof purchaseOrderId === "object" &&
    purchaseOrderId._id
  ) {
    normalizedPurchaseOrderId =
      purchaseOrderId._id;
  }

  if (
    normalizedPurchaseOrderId &&
    typeof normalizedPurchaseOrderId !== "string"
  ) {
    normalizedPurchaseOrderId =
      normalizedPurchaseOrderId.toString();
  }

  if (
    typeof normalizedPurchaseOrderId === "string"
  ) {
    normalizedPurchaseOrderId =
      normalizedPurchaseOrderId.trim();
  }

  console.log(
    "=========================================="
  );

  console.log(
    "DISPATCH PO VALIDATION"
  );

  console.log(
    "Original PO ID:",
    purchaseOrderId
  );

  console.log(
    "Normalized PO ID:",
    normalizedPurchaseOrderId
  );

  console.log(
    "Vendor ID:",
    vendorId
  );

  console.log(
    "Is Valid ObjectId:",
    mongoose.Types.ObjectId.isValid(
      normalizedPurchaseOrderId
    )
  );

  console.log(
    "=========================================="
  );

  if (
    !mongoose.Types.ObjectId.isValid(
      normalizedPurchaseOrderId
    )
  ) {
    throw new Error(
      "Invalid Purchase Order ID."
    );
  }

  if (
    !mongoose.Types.ObjectId.isValid(
      vendorId
    )
  ) {
    throw new Error(
      "Invalid Vendor ID."
    );
  }

  const purchaseOrder =
    await PurchaseOrder.findOne({

      _id:
        normalizedPurchaseOrderId,

      vendor:
        vendorId,

      isDeleted:
        false,

    })
      .populate(
        "vendor",
        "vendorCode vendorName email"
      )
      .populate(
        "items.material",
        "materialCode materialName unitOfMeasure"
      );

  if (!purchaseOrder) {
    throw new Error(
      "Purchase Order not found or does not belong to this vendor."
    );
  }

  return purchaseOrder;
};


/**
 * ==========================================================
 * GET DISPATCHED QUANTITY
 * ==========================================================
 */

const getPreviouslyDispatchedQuantities = async (
  purchaseOrderId
) => {

  const dispatches =
    await Dispatch.find({
      purchaseOrder: purchaseOrderId,
      isDeleted: false,
      status: {
        $in: [
          "Dispatched",
          "In Transit",
          "Delivered",
        ],
      },
    }).select(
      "items"
    );

  const quantities = {};

  for (const dispatch of dispatches) {

    for (const item of dispatch.items || []) {

      /**
       * Replacement quantities must NOT reduce
       * the original PO pending quantity.
       */
      if (item.isReplacement) {
        continue;
      }

      const materialId =
        item.material.toString();

      if (!quantities[materialId]) {
        quantities[materialId] = 0;
      }

      quantities[materialId] +=
        Number(
          item.dispatchQuantity || 0
        );
    }
  }

  return quantities;
};


/**
 * ==========================================================
 * GET PREVIOUSLY DISPATCHED REPLACEMENT QUANTITIES
 * ==========================================================
 */

const getPreviouslyDispatchedReplacementQuantities =
  async (replacementRequestId) => {

    const dispatches =
      await Dispatch.find({

        "items.replacementRequest":
          replacementRequestId,

        isDeleted:
          false,

        status: {
          $in: [
            "Dispatched",
            "In Transit",
            "Delivered",
          ],
        },

      }).select("items");


    const quantities = {};


    for (const dispatch of dispatches) {

      for (const item of dispatch.items || []) {

        if (!item.isReplacement) {
          continue;
        }

        if (
          !item.replacementRequest ||
          item.replacementRequest.toString() !==
            replacementRequestId.toString()
        ) {
          continue;
        }

        const materialId =
          item.material.toString();

        if (!quantities[materialId]) {
          quantities[materialId] = 0;
        }

        quantities[materialId] +=
          Number(
            item.dispatchQuantity || 0
          );
      }
    }

    return quantities;
  };


/**
 * ==========================================================
 * PREPARE PO ITEM INFORMATION
 * ==========================================================
 */

const buildPOItemMap = (
  purchaseOrder
) => {

  const map = {};

  for (
    const item of purchaseOrder.items
  ) {

    const materialId =
      item.material._id
        ? item.material._id.toString()
        : item.material.toString();

    map[materialId] = {

      materialId,

      materialCode:
        item.materialCode ||
        item.material?.materialCode ||
        "",

      materialName:
        item.materialName ||
        item.material?.materialName ||
        "",

      unitOfMeasure:
        item.unitOfMeasure ||
        item.material?.unitOfMeasure ||
        "",

      quantity:
        Number(item.quantity || 0),
    };
  }

  return map;
};


/**
 * ==========================================================
 * GET REPLACEMENT REQUEST FOR VENDOR
 * ==========================================================
 */

const getVendorReplacementRequest = async (
  replacementRequestId,
  vendorId
) => {

  if (
    !replacementRequestId ||
    !mongoose.Types.ObjectId.isValid(
      replacementRequestId
    )
  ) {
    throw new Error(
      "Valid Replacement Request ID is required."
    );
  }

  if (
    !vendorId ||
    !mongoose.Types.ObjectId.isValid(
      vendorId
    )
  ) {
    throw new Error(
      "Invalid Vendor ID."
    );
  }

  const replacementRequest =
    await ReplacementRequest.findOne({

      _id:
        replacementRequestId,

      vendor:
        vendorId,

      isDeleted:
        false,

    });

  if (!replacementRequest) {
    throw new Error(
      "Replacement request not found or does not belong to this vendor."
    );
  }

  const allowedReplacementStatuses = [
    "Vendor Accepted",
    "Partially Dispatched",
  ];

  if (
    !allowedReplacementStatuses.includes(
      replacementRequest.status
    )
  ) {
    throw new Error(
      `Replacement request is not ready for dispatch. Current status: "${replacementRequest.status}".`
    );
  }

  return replacementRequest;
};


/**
 * ==========================================================
 * GET DISPATCHABLE PURCHASE ORDER
 * ==========================================================
 */

export const getDispatchablePurchaseOrder =
  async (
    purchaseOrderId,
    vendorId
  ) => {

    const purchaseOrder =
      await getVendorPurchaseOrder(
        purchaseOrderId,
        vendorId
      );

    if (
      purchaseOrder.status !==
      "Accepted"
    ) {
      throw new Error(
        "Only accepted Purchase Orders can be dispatched."
      );
    }

    const dispatchedQuantities =
      await getPreviouslyDispatchedQuantities(
        purchaseOrder._id
      );

    const poItems =
      buildPOItemMap(
        purchaseOrder
      );

    const items = Object.values(
      poItems
    ).map((item) => {

      const dispatched =
        Number(
          dispatchedQuantities[
            item.materialId
          ] || 0
        );

      const remaining = Math.max(
        item.quantity - dispatched,
        0
      );

      return {

        material:
          item.materialId,

        materialCode:
          item.materialCode,

        materialName:
          item.materialName,

        unitOfMeasure:
          item.unitOfMeasure,

        orderedQuantity:
          item.quantity,

        previouslyDispatchedQuantity:
          dispatched,

        remainingQuantity:
          remaining,

        dispatchQuantity:
          0,
      };
    });

    return {
      purchaseOrder,
      items,
    };
  };


/**
 * ==========================================================
 * UPDATE VENDOR DISPATCH STATUS
 * ==========================================================
 *
 * Normal:
 *
 * Draft
 *   ↓
 * Dispatched
 *   ↓
 * In Transit
 *   ↓
 * Delivered
 *
 * Replacement:
 *
 * Dispatched
 *   ↓
 * Replacement Dispatched
 *
 * In Transit
 *   ↓
 * Replacement In Transit
 *
 * Delivered
 *   ↓
 * Replacement Received
 *
 * IMPORTANT:
 *
 * Delivered means the physical shipment has arrived.
 *
 * The organization-side Goods Receipt and Quality Inspection
 * are separate workflow steps.
 *
 * ==========================================================
 */

export const updateVendorDispatchStatus = async (
  dispatchId,
  vendorId,
  userId,
  data
) => {

  if (
    !mongoose.Types.ObjectId.isValid(
      dispatchId
    )
  ) {
    throw new Error(
      "Invalid Dispatch ID."
    );
  }

  const {
    status,
    remarks = "",
    location = "",
  } = data;

  const allowedStatuses = [
    "Dispatched",
    "In Transit",
    "Delivered",
  ];

  if (
    !allowedStatuses.includes(
      status
    )
  ) {
    throw new Error(
      "Invalid dispatch status."
    );
  }

  const dispatch =
    await Dispatch.findOne({

      _id:
        dispatchId,

      vendor:
        vendorId,

      isDeleted:
        false,

    });

  if (!dispatch) {
    throw new Error(
      "Dispatch not found or does not belong to this vendor."
    );
  }

  const currentStatus =
    dispatch.status;

  const validTransitions = {

    Draft:
      ["Dispatched"],

    Dispatched:
      ["In Transit"],

    "In Transit":
      ["Delivered"],

    Delivered:
      [],

    Cancelled:
      [],
  };

  const nextStatuses =
    validTransitions[
      currentStatus
    ] || [];

  if (
    !nextStatuses.includes(
      status
    )
  ) {
    throw new Error(
      `Cannot change dispatch status from "${currentStatus}" to "${status}".`
    );
  }

  /**
   * ========================================================
   * UPDATE DISPATCH
   * ========================================================
   */

  dispatch.status =
    status;

  dispatch.updatedBy =
    userId;

  /**
   * ========================================================
   * TRACKING HISTORY
   * ========================================================
   */

  if (
    !Array.isArray(
      dispatch.trackingHistory
    )
  ) {
    dispatch.trackingHistory = [];
  }

  let finalLocation = location;

  if (status === "Delivered" && !finalLocation) {
    const po = await PurchaseOrder.findById(dispatch.purchaseOrder).select("deliveryLocation");
    if (po?.deliveryLocation) {
      finalLocation = po.deliveryLocation;
    }
  }

  dispatch.trackingHistory.push({

    status,

    remarks,

    location: finalLocation,

    updatedBy:
      userId,

    updatedAt:
      new Date(),
  });

  const updatedDispatch =
    await dispatch.save();


  /**
   * ========================================================
   * UPDATE REPLACEMENT REQUEST STATUS
   * ========================================================
   */

  const replacementItems =
    dispatch.items?.filter(
      (item) =>
        item.isReplacement &&
        item.replacementRequest
    ) || [];


  if (
    replacementItems.length > 0
  ) {

    const replacementRequestIds =
      [
        ...new Set(
          replacementItems.map(
            (item) =>
              item.replacementRequest.toString()
          )
        ),
      ];


    for (
      const replacementRequestId
      of replacementRequestIds
    ) {

      const replacementRequest =
        await ReplacementRequest.findOne({

          _id:
            replacementRequestId,

          vendor:
            vendorId,

          isDeleted:
            false,

        });


      if (!replacementRequest) {
        continue;
      }


      const previousReplacementStatus =
        replacementRequest.status;


      /**
       * ------------------------------------------------------
       * DISPATCHED
       * ------------------------------------------------------
       */

      if (
        status ===
        "Dispatched"
      ) {

        const hasPendingQuantity =
          replacementRequest.items.some(
            (item) =>
              Number(
                item.replacementPendingQuantity || 0
              ) > 0
          );


        const hasDispatchedQuantity =
          replacementRequest.items.some(
            (item) =>
              Number(
                item.replacementDispatchedQuantity || 0
              ) > 0
          );


        if (
          hasDispatchedQuantity &&
          hasPendingQuantity
        ) {

          replacementRequest.status =
            "Partially Dispatched";

        } else if (
          hasDispatchedQuantity &&
          !hasPendingQuantity
        ) {

          replacementRequest.status =
            "Replacement Dispatched";
        }
      }


      /**
       * ------------------------------------------------------
       * IN TRANSIT
       * ------------------------------------------------------
       */

      if (
        status ===
        "In Transit"
      ) {

        replacementRequest.status =
          "Replacement In Transit";
      }


      /**
       * ------------------------------------------------------
       * DELIVERED
       * ------------------------------------------------------
       *
       * Vendor shipment has arrived.
       *
       * Organization still has to:
       *
       * Delivered
       *    ↓
       * Goods Receipt
       *    ↓
       * Quality Inspection
       *
       * ------------------------------------------------------
       */

      if (
        status ===
        "Delivered"
      ) {

        replacementRequest.status =
          "Replacement Received";
      }


      /**
       * ------------------------------------------------------
       * SAVE STATUS HISTORY
       * ------------------------------------------------------
       */

      if (
        previousReplacementStatus !==
        replacementRequest.status
      ) {

        if (
          !Array.isArray(
            replacementRequest.history
          )
        ) {
          replacementRequest.history = [];
        }


        replacementRequest.history.push({

          action:
            "Replacement Dispatch Status Updated",

          previousStatus:
            previousReplacementStatus,

          newStatus:
            replacementRequest.status,

          performedBy:
            userId,

          performedAt:
            new Date(),

          remarks:
            remarks ||
            `Replacement dispatch ${dispatch.dispatchNumber} status changed from "${currentStatus}" to "${status}".`,
        });


        replacementRequest.updatedBy =
          userId;


        await replacementRequest.save();
      }
    }
  }


  /**
   * ========================================================
   * RETURN UPDATED DISPATCH
   * ========================================================
   */

  return await Dispatch.findById(
    updatedDispatch._id
  )
    .populate(
      "purchaseOrder",
      "poNumber status expectedDeliveryDate deliveryLocation"
    )
    .populate(
      "vendor",
      "vendorCode vendorName email"
    )
    .populate(
      "items.material",
      "materialCode materialName unitOfMeasure"
    )
    .populate(
      "items.replacementRequest"
    );
};


/**
 * ==========================================================
 * GET VENDOR DISPATCH OVERVIEW
 * ==========================================================
 */

export const getVendorDispatchOverview =
  async (vendorId) => {

    const purchaseOrders =
      await PurchaseOrder.find({

        vendor:
          vendorId,

        status:
          "Accepted",

        isDeleted:
          false,

        vendorAccepted:
          true,

      })
        .populate(
          "vendor",
          "vendorCode vendorName email"
        )
        .populate(
          "purchaseRequisition",
          "prNumber department requiredDate priority purpose"
        )
        .populate(
          "items.material",
          "materialCode materialName unitOfMeasure"
        )
        .sort({
          createdAt: -1,
        });


    const overview = [];


    for (
      const purchaseOrder of purchaseOrders
    ) {

      const dispatchedQuantities =
        await getPreviouslyDispatchedQuantities(
          purchaseOrder._id
        );


      const items =
        purchaseOrder.items.map(
          (item) => {

            const materialId =
              item.material?._id
                ? item.material._id.toString()
                : item.material.toString();


            const orderedQuantity =
              Number(
                item.quantity || 0
              );


            const dispatchedQuantity =
              Number(
                dispatchedQuantities[
                  materialId
                ] || 0
              );


            const remainingQuantity =
              Math.max(
                orderedQuantity -
                  dispatchedQuantity,
                0
              );


            return {

              material:
                materialId,

              materialCode:
                item.materialCode ||
                item.material?.materialCode ||
                "",

              materialName:
                item.materialName ||
                item.material?.materialName ||
                "",

              unitOfMeasure:
                item.unitOfMeasure ||
                item.material?.unitOfMeasure ||
                "",

              orderedQuantity,

              dispatchedQuantity,

              remainingQuantity,
            };
          }
        );


      const orderedQuantity =
        items.reduce(
          (
            total,
            item
          ) =>
            total +
            item.orderedQuantity,
          0
        );


      const dispatchedQuantity =
        items.reduce(
          (
            total,
            item
          ) =>
            total +
            item.dispatchedQuantity,
          0
        );


      const pendingQuantity =
        items.reduce(
          (
            total,
            item
          ) =>
            total +
            item.remainingQuantity,
          0
        );


      let dispatchStatus =
        "Ready to Dispatch";


      if (
        dispatchedQuantity === 0
      ) {

        dispatchStatus =
          "Ready to Dispatch";

      } else if (
        pendingQuantity > 0
      ) {

        dispatchStatus =
          "Partial Dispatch";

      } else {

        dispatchStatus =
          "Fully Dispatched";
      }


      const canDispatch =
        pendingQuantity > 0;


      const latestDispatch =
        await Dispatch.findOne({

          purchaseOrder:
            purchaseOrder._id,

          vendor:
            vendorId,

          isDeleted:
            false,

        })
          .sort({
            createdAt: -1,
          })
          .select(
            "_id status dispatchNumber dispatchDate"
          );


      overview.push({

        _id:
          purchaseOrder._id,

        poNumber:
          purchaseOrder.poNumber,

        purchaseRequisition:
          purchaseOrder.purchaseRequisition,

        vendor:
          purchaseOrder.vendor,

        orderDate:
          purchaseOrder.orderDate,

        requiredDate:
          purchaseOrder
            .purchaseRequisition
            ?.requiredDate ||
          null,

        expectedDeliveryDate:
          purchaseOrder
            .expectedDeliveryDate ||
          null,

        priority:
          purchaseOrder.priority,

        paymentTerms:
          purchaseOrder.paymentTerms,

        deliveryLocation:
          purchaseOrder.deliveryLocation,

        currency:
          purchaseOrder.currency,

        status:
          purchaseOrder.status,

        vendorAccepted:
          purchaseOrder.vendorAccepted,

        vendorResponseDate:
          purchaseOrder.vendorResponseDate,

        items,

        orderedQuantity,

        dispatchedQuantity,

        pendingQuantity,

        dispatchStatus,

        canDispatch,

        latestDispatchId:
          latestDispatch?._id ||
          null,

        latestDispatchStatus:
          latestDispatch?.status ||
          "",

        latestDispatchNumber:
          latestDispatch?.dispatchNumber ||
          "",

        latestDispatchDate:
          latestDispatch?.dispatchDate ||
          null,
      });
    }


    return {

      purchaseOrders:
        overview,

      total:
        overview.length,
    };
  };


/**
 * ==========================================================
 * VALIDATE DISPATCH ITEMS
 * ==========================================================
 */

const validateDispatchItems = ({
  purchaseOrder,
  requestedItems,
  previousQuantities,
  isReplacement,
  replacementRequest = null,
  replacementQuantities = {},
}) => {

  if (
    !Array.isArray(
      requestedItems
    ) ||
    requestedItems.length === 0
  ) {

    throw new Error(
      "At least one dispatch item is required."
    );
  }

  const poItemMap =
    buildPOItemMap(
      purchaseOrder
    );

  const validatedItems = [];


  for (
    const requestedItem of requestedItems
  ) {

    const materialId =
      requestedItem.material?.toString();

    if (!materialId) {
      throw new Error(
        "Material is required for every dispatch item."
      );
    }

    const poItem =
      poItemMap[materialId];

    if (!poItem) {
      throw new Error(
        `Material ${materialId} does not belong to this Purchase Order.`
      );
    }

    const dispatchQuantity =
      Number(
        requestedItem.dispatchQuantity
      );

    if (
      !Number.isFinite(
        dispatchQuantity
      ) ||
      dispatchQuantity <= 0
    ) {

      throw new Error(
        `Invalid dispatch quantity for ${poItem.materialName}.`
      );
    }

    const previouslyDispatched =
      Number(
        previousQuantities[
          materialId
        ] || 0
      );


    /**
     * ======================================================
     * NORMAL DISPATCH
     * ======================================================
     */

    if (!isReplacement) {

      const remaining =
        Math.max(
          poItem.quantity -
            previouslyDispatched,
          0
        );


      if (
        dispatchQuantity >
        remaining
      ) {

        throw new Error(
          `${poItem.materialName}: dispatch quantity ${dispatchQuantity} exceeds remaining quantity ${remaining}.`
        );
      }


      validatedItems.push({

        material:
          materialId,

        materialCode:
          poItem.materialCode,

        materialName:
          poItem.materialName,

        unitOfMeasure:
          poItem.unitOfMeasure,

        orderedQuantity:
          poItem.quantity,

        previouslyDispatchedQuantity:
          previouslyDispatched,

        dispatchQuantity,

        remainingQuantity:
          remaining -
          dispatchQuantity,

        isReplacement:
          false,

        replacementRequest:
          null,

        originalDispatch:
          null,

        remarks:
          requestedItem.remarks ||
          "",
      });

      continue;
    }


    /**
     * ======================================================
     * REPLACEMENT DISPATCH
     * ======================================================
     */

    if (!replacementRequest) {
      throw new Error(
        "Replacement Request is required for replacement dispatch."
      );
    }


    const replacementItem =
      replacementRequest.items.find(
        (item) =>
          item.material.toString() ===
          materialId
      );


    if (!replacementItem) {

      throw new Error(
        `${poItem.materialName}: material is not included in the replacement request.`
      );
    }


    const approvedQuantity =
      Number(
        replacementItem.replacementApprovedQuantity ||
        replacementItem.replacementQuantity ||
        0
      );


    const previouslyReplacementDispatched =
      Number(
        replacementQuantities[
          materialId
        ] || 0
      );


    const remainingReplacementQuantity =
      Math.max(
        approvedQuantity -
        previouslyReplacementDispatched,
        0
      );


    if (
      dispatchQuantity >
      remainingReplacementQuantity
    ) {

      throw new Error(
        `${poItem.materialName}: replacement dispatch quantity ${dispatchQuantity} exceeds remaining approved replacement quantity ${remainingReplacementQuantity}.`
      );
    }


    validatedItems.push({

      material:
        materialId,

      materialCode:
        poItem.materialCode,

      materialName:
        poItem.materialName,

      unitOfMeasure:
        poItem.unitOfMeasure,

      orderedQuantity:
        approvedQuantity,

      previouslyDispatchedQuantity:
        previouslyReplacementDispatched,

      dispatchQuantity,

      remainingQuantity:
        remainingReplacementQuantity -
        dispatchQuantity,

      isReplacement:
        true,

      replacementRequest:
        replacementRequest._id,

      originalDispatch:
        replacementRequest.originalDispatch,

      remarks:
        requestedItem.remarks ||
        "",
    });
  }


  return validatedItems;
};


/**
 * ==========================================================
 * CREATE DISPATCH
 * ==========================================================
 */

export const createVendorDispatch =
  async (
    data,
    vendorId,
    userId
  ) => {

    if (!vendorId) {
      throw new Error(
        "Vendor account is required."
      );
    }


    const purchaseOrder =
      await getVendorPurchaseOrder(
        data.purchaseOrder,
        vendorId
      );


    if (
      purchaseOrder.status !==
      "Accepted"
    ) {

      throw new Error(
        "Only accepted Purchase Orders can be dispatched."
      );
    }


    /**
     * ======================================================
     * REPLACEMENT FLAG
     * ======================================================
     */

    const isReplacement =
      Boolean(
        data.isReplacement
      );


    /**
     * ======================================================
     * REPLACEMENT REQUEST
     * ======================================================
 */

    let replacementRequest =
      null;

    let replacementQuantities =
      {};


    if (isReplacement) {

      if (
        !data.replacementRequest
      ) {

        throw new Error(
          "Replacement Request ID is required for a replacement dispatch."
        );
      }


      replacementRequest =
        await getVendorReplacementRequest(
          data.replacementRequest,
          vendorId
        );


      replacementQuantities =
        await getPreviouslyDispatchedReplacementQuantities(
          replacementRequest._id
        );


      if (
        replacementRequest.purchaseOrder
          .toString() !==
        purchaseOrder._id.toString()
      ) {

        throw new Error(
          "Replacement request does not belong to this Purchase Order."
        );
      }
    }


    /**
     * ======================================================
     * EXISTING DISPATCHED QUANTITIES
     * ======================================================
     */

    const previousQuantities =
      await getPreviouslyDispatchedQuantities(
        purchaseOrder._id
      );


    /**
     * ======================================================
     * VALIDATE ITEMS
     * ======================================================
     */

    const validatedItems =
      validateDispatchItems({

        purchaseOrder,

        requestedItems:
          data.items,

        previousQuantities,

        isReplacement,

        replacementRequest,

        replacementQuantities,
      });


    /**
     * ======================================================
     * DETERMINE FULL / PARTIAL / REPLACEMENT
     * ======================================================
     */

    let dispatchType =
      "Full";


    if (!isReplacement) {

      const hasRemaining =
        validatedItems.some(
          (item) =>
            item.remainingQuantity >
            0
        );


      if (hasRemaining) {
        dispatchType =
          "Partial";
      }

    } else {

      dispatchType =
        "Replacement";
    }


    /**
     * ======================================================
     * PARTIAL DISPATCH VALIDATION
     * ======================================================
     */

    if (
      dispatchType ===
      "Partial"
    ) {

      if (
        !data.partialDispatchReason
      ) {

        throw new Error(
          "Partial dispatch reason is required."
        );
      }


      if (
        !data.expectedRemainingDeliveryDate
      ) {

        throw new Error(
          "Expected remaining delivery date is required for partial dispatch."
        );
      }
    }


    /**
     * ======================================================
     * PREPARE DISPATCH DATA
     * ======================================================
     *
     * We generate the dispatch number immediately before
     * creation.
     *
     * If another request creates the same number at exactly
     * the same time, MongoDB's unique index is handled by
     * retrying the creation with a fresh number.
     *
     * ======================================================
     */

    const dispatchData = {

      purchaseOrder:
        purchaseOrder._id,

      vendor:
        vendorId,

      dispatchDate:
        data.dispatchDate ||
        new Date(),

      expectedDeliveryDate:
        data.expectedDeliveryDate ||
        null,

      dispatchType,

      partialDispatchReason:
        data.partialDispatchReason ||
        "",

      partialDispatchRemarks:
        data.partialDispatchRemarks ||
        "",

      expectedRemainingDeliveryDate:
        data.expectedRemainingDeliveryDate ||
        null,

      transporterName:
        data.transporterName ||
        "",

      vehicleNumber:
        data.vehicleNumber ||
        "",

      driverName:
        data.driverName ||
        "",

      driverContact:
        data.driverContact ||
        "",

      shippingMethod:
        data.shippingMethod ||
        "",

      lrNumber:
        data.lrNumber ||
        "",

      trackingNumber:
        data.trackingNumber ||
        "",

      awbNumber:
        data.awbNumber ||
        "",

      consignmentNumber:
        data.consignmentNumber ||
        "",

      packageCount:
        Number(
          data.packageCount || 0
        ),

      totalWeight:
        Number(
          data.totalWeight || 0
        ),

      weightUnit:
        data.weightUnit ||
        "Kg",

      packageType:
        data.packageType ||
        "",

      items:
        validatedItems,

      status:
        data.status ||
        "Dispatched",

      documents:
        Array.isArray(
          data.documents
        )
          ? data.documents
          : [],

      remarks:
        data.remarks ||
        "",

      createdBy:
        userId,

      updatedBy:
        userId,
    };


    /**
     * ======================================================
     * CREATE DISPATCH WITH UNIQUE NUMBER
     * ======================================================
     *
     * Maximum 5 attempts.
     *
     * This protects against:
     *
     * E11000 duplicate key
     *
     * when two dispatches are created almost simultaneously.
     *
     * ======================================================
     */

    let dispatch = null;

    const MAX_DISPATCH_NUMBER_ATTEMPTS = 5;

    for (
      let attempt = 1;
      attempt <= MAX_DISPATCH_NUMBER_ATTEMPTS;
      attempt++
    ) {

      const dispatchNumber =
        await generateDispatchNumber();

      try {

        dispatch =
          await Dispatch.create({

            ...dispatchData,

            dispatchNumber,

          });

        break;

      } catch (error) {

        const isDuplicateDispatchNumber =
          error?.code === 11000 &&
          (
            error?.keyPattern?.dispatchNumber ||
            error?.keyValue?.dispatchNumber
          );

        if (
          isDuplicateDispatchNumber &&
          attempt <
            MAX_DISPATCH_NUMBER_ATTEMPTS
        ) {

          console.warn(
            `Duplicate dispatch number ${dispatchNumber}. Retrying dispatch number generation. Attempt ${attempt + 1}/${MAX_DISPATCH_NUMBER_ATTEMPTS}.`
          );

          continue;
        }

        throw error;
      }
    }


    if (!dispatch) {

      throw new Error(
        "Unable to generate a unique dispatch number. Please try again."
      );
    }


    /**
     * ======================================================
     * UPDATE REPLACEMENT REQUEST
     * ======================================================
     */

    if (isReplacement) {

      /**
       * ----------------------------------------------------
       * Add quantities to replacement request
       * ----------------------------------------------------
       */

      for (
        const item of validatedItems
      ) {

        const replacementItem =
          replacementRequest.items.find(
            (requestItem) =>
              requestItem.material.toString() ===
              item.material.toString()
          );


        if (!replacementItem) {
          continue;
        }


        const dispatchQuantity =
          Number(
            item.dispatchQuantity || 0
          );


        replacementItem.replacementDispatchedQuantity =
          Number(
            replacementItem.replacementDispatchedQuantity || 0
          ) +
          dispatchQuantity;


        replacementItem.replacementPendingQuantity =
          Math.max(

            Number(
              replacementItem.replacementApprovedQuantity ||
              replacementItem.replacementQuantity ||
              0
            ) -

            Number(
              replacementItem.replacementDispatchedQuantity ||
              0
            ),

            0
          );
      }


      /**
       * ----------------------------------------------------
       * Add dispatch history
       * ----------------------------------------------------
       */

      const totalDispatchQuantity =
        validatedItems.reduce(
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


      if (
        !Array.isArray(
          replacementRequest.dispatchHistory
        )
      ) {
        replacementRequest.dispatchHistory =
          [];
      }


      replacementRequest.dispatchHistory.push({

        dispatch:
          dispatch._id,

        dispatchNumber:
          dispatch.dispatchNumber,

        dispatchDate:
          dispatch.dispatchDate,

        quantity:
          totalDispatchQuantity,

        addedBy:
          userId,

        addedAt:
          new Date(),

        remarks:
          data.remarks || "",
      });


      /**
       * ----------------------------------------------------
       * Determine replacement status
       * ----------------------------------------------------
       */

      const hasPendingQuantity =
        replacementRequest.items.some(
          (item) =>
            Number(
              item.replacementPendingQuantity || 0
            ) > 0
        );


      const hasDispatchedQuantity =
        replacementRequest.items.some(
          (item) =>
            Number(
              item.replacementDispatchedQuantity || 0
            ) > 0
        );


      const previousStatus =
        replacementRequest.status;


      if (
        hasDispatchedQuantity &&
        hasPendingQuantity
      ) {

        replacementRequest.status =
          "Partially Dispatched";

      } else if (
        hasDispatchedQuantity &&
        !hasPendingQuantity
      ) {

        replacementRequest.status =
          "Replacement Dispatched";
      }


      /**
       * ----------------------------------------------------
       * First replacement dispatch reference
       * ----------------------------------------------------
       *
       * Existing field is preserved.
       *
       * Full dispatch history remains in:
       *
       * replacementRequest.dispatchHistory
       *
       * ----------------------------------------------------
       */

      replacementRequest.replacementDispatch =
        replacementRequest.replacementDispatch ||
        dispatch._id;


      replacementRequest.updatedBy =
        userId;


      if (
        !Array.isArray(
          replacementRequest.history
        )
      ) {
        replacementRequest.history =
          [];
      }


      replacementRequest.history.push({

        action:
          "Replacement Dispatch Created",

        previousStatus:
          previousStatus,

        newStatus:
          replacementRequest.status,

        performedBy:
          userId,

        performedAt:
          new Date(),

        remarks:
          `Replacement dispatch ${dispatch.dispatchNumber} created.`,
      });


      await replacementRequest.save();
    }


    /**
     * ======================================================
     * POPULATE RESULT
     * ======================================================
     */

    // 🔔 Notify admin & purchase managers of new vendor dispatch (In-App + Email)
    createForRole(["SUPER_ADMIN", "ADMIN", "PURCHASE_MANAGER"], {
      category: "dispatch",
      priority: "info",
      title: "New Shipment Dispatched by Vendor",
      message: `Dispatch ${dispatch.dispatchNumber} has been created by the vendor for ${purchaseOrder.poNumber}. Items are in transit.`,
      sourceModel: "Dispatch",
      sourceId: dispatch._id,
      actionUrl: `/grn?dispatchId=${dispatch._id}`,
      actionLabel: "Create Goods Receipt",
      sendEmailNotification: true,
    });

    return await Dispatch.findById(
      dispatch._id
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
      .populate(
        "items.replacementRequest"
      );
  };


/**
 * ==========================================================
 * GET ALL VENDOR DISPATCHES
 * ==========================================================
 */

export const getVendorDispatches =
  async ({
    vendorId,
    page = 1,
    limit = 10,
    search = "",
    status = "",
  }) => {

    const query = {

      vendor:
        vendorId,

      isDeleted:
        false,
    };


    if (search) {

      query.dispatchNumber = {

        $regex:
          search,

        $options:
          "i",
      };
    }


    if (status) {
      query.status =
        status;
    }


    const total =
      await Dispatch.countDocuments(
        query
      );


    const dispatches =
      await Dispatch.find(
        query
      )
        .populate(
          "purchaseOrder",
          "poNumber status expectedDeliveryDate"
        )
        .populate(
          "vendor",
          "vendorCode vendorName"
        )
        .populate(
          "items.material",
          "materialCode materialName unitOfMeasure"
        )
        .populate(
          "items.replacementRequest"
        )
        .sort({
          createdAt: -1,
        })
        .skip(
          (Number(page) - 1) *
            Number(limit)
        )
        .limit(
          Number(limit)
        );


    return {

      dispatches,

      total,

      page:
        Number(page),

      pages:
        Math.ceil(
          total /
          Number(limit)
        ),
    };
  };

/**
 * ==========================================================
 * GET PURCHASE ORDER DISPATCH HISTORY
 * ==========================================================
 *
 * GET
 * /api/vendor/dispatches/purchase-orders/:purchaseOrderId/history
 *
 * Returns EVERY dispatch created against the Purchase Order.
 *
 * Example:
 *
 * PO Quantity = 100
 *
 * DSP000001 → 95
 * DSP000002 → 5
 *
 * Both dispatches are returned.
 *
 * This is intentionally separate from
 * getVendorDispatchOverview().
 *
 * ==========================================================
 */

export const getPurchaseOrderDispatchHistory =
  async (
    purchaseOrderId,
    vendorId
  ) => {

    if (
      !mongoose.Types.ObjectId.isValid(
        purchaseOrderId
      )
    ) {
      throw new Error(
        "Invalid Purchase Order ID."
      );
    }

    if (
      !mongoose.Types.ObjectId.isValid(
        vendorId
      )
    ) {
      throw new Error(
        "Invalid Vendor ID."
      );
    }

    // ------------------------------------------------------
    // Verify PO belongs to vendor
    // ------------------------------------------------------

    const purchaseOrder =
      await PurchaseOrder.findOne({

        _id:
          purchaseOrderId,

        vendor:
          vendorId,

        isDeleted:
          false,

      })
        .populate(
          "vendor",
          "vendorCode vendorName email"
        )
        .populate(
          "items.material",
          "materialCode materialName unitOfMeasure"
        );

    if (!purchaseOrder) {

      const error =
        new Error(
          "Purchase Order not found or does not belong to this vendor."
        );

      error.statusCode =
        404;

      throw error;
    }

    // ------------------------------------------------------
    // Get ALL dispatches for this PO
    // ------------------------------------------------------

    const dispatches =
      await Dispatch.find({

        purchaseOrder:
          purchaseOrderId,

        vendor:
          vendorId,

        isDeleted:
          false,

      })
        .populate(
          "purchaseOrder",
          "poNumber status expectedDeliveryDate deliveryLocation"
        )
        .populate(
          "vendor",
          "vendorCode vendorName email"
        )
        .populate(
          "items.material",
          "materialCode materialName unitOfMeasure"
        )
        .populate(
          "items.replacementRequest"
        )
        .sort({
          dispatchDate: 1,
          createdAt: 1,
        });

    // ------------------------------------------------------
    // Calculate dispatch totals
    //
    // Replacement quantities are kept separate from
    // original PO fulfillment.
    // ------------------------------------------------------

    let originalDispatchedQuantity = 0;

    let replacementDispatchedQuantity = 0;

    const dispatchSummary =
      dispatches.map(
        (dispatch) => {

          let dispatchQuantity = 0;

          let originalQuantity = 0;

          let replacementQuantity = 0;

          for (
            const item of dispatch.items || []
          ) {

            const quantity =
              Number(
                item.dispatchQuantity || 0
              );

            dispatchQuantity +=
              quantity;

            if (
              item.isReplacement
            ) {

              replacementQuantity +=
                quantity;

            } else {

              originalQuantity +=
                quantity;

            }
          }

          originalDispatchedQuantity +=
            originalQuantity;

          replacementDispatchedQuantity +=
            replacementQuantity;

          return {

            _id:
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

            dispatchQuantity,

            originalQuantity,

            replacementQuantity,

            items:
              dispatch.items,

            transporterName:
              dispatch.transporterName,

            vehicleNumber:
              dispatch.vehicleNumber,

            trackingNumber:
              dispatch.trackingNumber,

            lrNumber:
              dispatch.lrNumber,

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

            documents:
              dispatch.documents,

            remarks:
              dispatch.remarks,

            trackingHistory:
              dispatch.trackingHistory,

            createdAt:
              dispatch.createdAt,

            updatedAt:
              dispatch.updatedAt,
          };
        }
      );

    // ------------------------------------------------------
    // Calculate PO totals
    // ------------------------------------------------------

    const orderedQuantity =
      purchaseOrder.items.reduce(
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

    const pendingQuantity =
      Math.max(
        orderedQuantity -
        originalDispatchedQuantity,
        0
      );

    // ------------------------------------------------------
    // Return
    // ------------------------------------------------------

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

        expectedDeliveryDate:
          purchaseOrder.expectedDeliveryDate,

        deliveryLocation:
          purchaseOrder.deliveryLocation,

      },

      summary: {

        orderedQuantity,

        originalDispatchedQuantity,

        pendingQuantity,

        replacementDispatchedQuantity,

        totalDispatches:
          dispatches.length,

      },

      dispatches:
        dispatchSummary,
    };
  };
/**
 * ==========================================================
 * GET DISPATCH BY ID
 * ==========================================================
 */

export const getVendorDispatchById =
  async (
    dispatchId,
    vendorId
  ) => {

    if (
      !mongoose.Types.ObjectId.isValid(
        dispatchId
      )
    ) {

      throw new Error(
        "Invalid Dispatch ID."
      );
    }


    const dispatch =
      await Dispatch.findOne({

        _id:
          dispatchId,

        vendor:
          vendorId,

        isDeleted:
          false,

      })
        .populate(
          "purchaseOrder",
          "poNumber status expectedDeliveryDate deliveryLocation"
        )
        .populate(
          "vendor",
          "vendorCode vendorName email"
        )
        .populate(
          "items.material",
          "materialCode materialName unitOfMeasure"
        )
        .populate(
          "items.replacementRequest"
        );


    if (!dispatch) {

      const error =
        new Error(
          "Dispatch not found or does not belong to this vendor."
        );

      error.statusCode =
        404;

      throw error;
    }


    return dispatch;
  };


/**
 * ==========================================================
 * CANCEL DISPATCH
 * ==========================================================
 *
 * Only Draft dispatches can be cancelled.
 * Once dispatched, we do not silently delete it.
 * ==========================================================
 */

export const cancelVendorDispatch =
  async (
    dispatchId,
    vendorId,
    userId
  ) => {

    const dispatch =
      await Dispatch.findOne({

        _id:
          dispatchId,

        vendor:
          vendorId,

        isDeleted:
          false,

      });


    if (!dispatch) {

      throw new Error(
        "Dispatch not found."
      );
    }


    if (
      dispatch.status !==
      "Draft"
    ) {

      throw new Error(
        "Only draft dispatches can be cancelled."
      );
    }


    dispatch.status =
      "Cancelled";

    dispatch.updatedBy =
      userId;


    await dispatch.save();


    return dispatch;
  };