import mongoose from "mongoose";

import GoodsReceipt from "../models/GoodsReceipt.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import Dispatch from "../models/Dispatch.js";
import ReplacementRequest from "../models/ReplacementRequest.js";
import { createForVendor, createForRole } from "./notificationService.js";


// =========================================================
// HELPER â€” OBJECT ID & STRING CONVERSION
// =========================================================

const isValidObjectId = (id) =>
  mongoose.Types.ObjectId.isValid(id);

const toIdString = (val) => String(val?._id || val || "");


// =========================================================
// VALIDATE PURCHASE ORDER + DISPATCH
// =========================================================

const validatePurchaseOrderAndDispatch =
  async ({
    purchaseOrderId,
    dispatchId,
  }) => {

    if (
      !purchaseOrderId ||
      !isValidObjectId(purchaseOrderId)
    ) {
      throw new Error(
        "Invalid Purchase Order ID."
      );
    }

    if (
      !dispatchId ||
      !isValidObjectId(dispatchId)
    ) {
      throw new Error(
        "Invalid Dispatch ID."
      );
    }


    const purchaseOrder =
      await PurchaseOrder.findOne({
        _id:
          purchaseOrderId,

        isDeleted:
          false,
      })
        .populate(
          "vendor",
          "vendorCode vendorName email mobile phone"
        )
        .populate(
          "items.material",
          "materialCode materialName unitOfMeasure"
        );


    if (!purchaseOrder) {
      throw new Error(
        "Purchase Order not found."
      );
    }


    const dispatch =
      await Dispatch.findOne({
        _id:
          dispatchId,

        isDeleted:
          false,
      })
        .populate(
          "purchaseOrder",
          "poNumber status"
        )
        .populate(
          "vendor",
          "vendorCode vendorName email mobile phone"
        )
        .populate(
          "items.material",
          "materialCode materialName unitOfMeasure"
        );


    if (!dispatch) {
      throw new Error(
        "Dispatch not found."
      );
    }


    if (
      dispatch.purchaseOrder?._id?.toString() !==
      purchaseOrder._id.toString()
    ) {
      throw new Error(
        "Dispatch does not belong to the selected Purchase Order."
      );
    }


    if (
      purchaseOrder.vendor?._id?.toString() !==
      dispatch.vendor?._id?.toString()
    ) {
      throw new Error(
        "Dispatch vendor does not match the Purchase Order vendor."
      );
    }


    return {
      purchaseOrder,
      dispatch,
    };
  };


// =========================================================
// GET REPLACEMENT REQUEST
// =========================================================

const getReplacementRequest =
  async (
    replacementRequestId
  ) => {

    if (
      !replacementRequestId ||
      !isValidObjectId(
        replacementRequestId
      )
    ) {
      throw new Error(
        "Invalid Replacement Request ID."
      );
    }


    const replacementRequest =
      await ReplacementRequest.findOne({

        _id:
          replacementRequestId,

        isDeleted:
          false,
      })
        .populate(
          "purchaseOrder",
          "poNumber status"
        )
        .populate(
          "vendor",
          "vendorCode vendorName email"
        )
        .populate(
          "originalDispatch",
          "dispatchNumber dispatchType status"
        );


    if (!replacementRequest) {
      throw new Error(
        "Replacement Request not found."
      );
    }


    return replacementRequest;
  };


// =========================================================
// BUILD PO ITEM MAP
// =========================================================

const buildPOItemMap =
  (purchaseOrder) => {

    const map = {};


    for (
      const item of
      purchaseOrder.items || []
    ) {

      const materialId =
        item.material?._id
          ? item.material._id.toString()
          : item.material?.toString();


      if (!materialId) {
        continue;
      }


      map[materialId] = {

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

        orderedQuantity:
          Number(
            item.quantity || 0
          ),
      };
    }


    return map;
  };


// =========================================================
// PREVIOUSLY RECEIVED â€” NORMAL GRN
// =========================================================
//
// IMPORTANT:
//
// This calculation is DISPATCH-LEVEL.
//
// It must NOT calculate previous receipts using
// purchaseOrderId.
//
// Example:
//
// PO = 100
//
// Dispatch 1 = 95
// GRN 1 = 95
//
// Dispatch 2 = 5
// GRN 2 = 0
//
// For Dispatch 2:
//
// previouslyReceivedQuantity = 0
// remainingDispatchQuantity = 5
//
// NOT:
//
// previouslyReceivedQuantity = 95
//
// =========================================================

const getPreviouslyReceivedQuantities =
  async (
    dispatchId,
    excludeGrnId = null
  ) => {

    if (
      !dispatchId ||
      !isValidObjectId(dispatchId)
    ) {
      throw new Error(
        "Invalid Dispatch ID."
      );
    }


    const query = {

      // =====================================================
      // IMPORTANT:
      // Receipt history is calculated for THIS dispatch only.
      // =====================================================

      dispatch:
        dispatchId,

      receiptType:
        "Normal",

      isDeleted:
        false,

      status:
        {
          $in: [
            "Draft",
            "Received",
            "Submitted",
            "Approved",
            "Quality Check",
            "Completed",
          ],
        },
    };


    if (
      excludeGrnId &&
      isValidObjectId(excludeGrnId)
    ) {

      query._id = {
        $ne:
          excludeGrnId,
      };
    }


    const receipts =
      await GoodsReceipt.find(
        query
      ).select(
        "items"
      );


    const quantities = {};


    for (
      const receipt of
      receipts
    ) {

      for (
        const item of
        receipt.items || []
      ) {

        if (
          !item.material
        ) {
          continue;
        }


        const materialId =
          toIdString(item.material);


        quantities[materialId] =
          Number(
            quantities[materialId] || 0
          ) +
          Number(
            item.receivedQuantity || 0
          );
      }
    }


    return quantities;
  };


// =========================================================
// PREVIOUSLY RECEIVED â€” REPLACEMENT GRN
// =========================================================

const getPreviouslyReplacementReceivedQuantities =
  async (
    replacementRequestId,
    replacementDispatchId,
    excludeGrnId = null
  ) => {

    const query = {

      replacementRequest:
        replacementRequestId,

      dispatch:
        replacementDispatchId,

      receiptType:
        "Replacement",

      isDeleted:
        false,

      status:
        {
          $in: [
            "Draft",
            "Received",
            "Submitted",
            "Approved",
            "Quality Check",
            "Completed",
          ],
        },
    };


    if (
      excludeGrnId &&
      isValidObjectId(excludeGrnId)
    ) {

      query._id = {
        $ne:
          excludeGrnId,
      };
    }


    const receipts =
      await GoodsReceipt.find(
        query
      ).select(
        "items"
      );


    const quantities = {};


    for (
      const receipt of
      receipts
    ) {

      for (
        const item of
        receipt.items || []
      ) {

        if (
          !item.material
        ) {
          continue;
        }


        const materialId =
          toIdString(item.material);


        quantities[materialId] =
          Number(
            quantities[materialId] || 0
          ) +
          Number(
            item.receivedQuantity || 0
          );
      }
    }


    return quantities;
  };


// =========================================================
// BUILD REPLACEMENT DISPATCH ITEM MAP
// =========================================================

const buildReplacementDispatchItemMap =
  (
    dispatch,
    replacementRequestId
  ) => {

    const map = {};


    for (
      const item of
      dispatch.items || []
    ) {

      if (
        !item.isReplacement
      ) {
        continue;
      }


      if (
        !item.replacementRequest
      ) {
        continue;
      }


      if (
        item.replacementRequest.toString() !==
        replacementRequestId.toString()
      ) {
        continue;
      }


      const materialId =
        item.material?._id
          ? item.material._id.toString()
          : item.material?.toString();


      if (!materialId) {
        continue;
      }


      map[materialId] = {

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

        dispatchedQuantity:
          Number(
            item.dispatchQuantity || 0
          ),
      };
    }


    return map;
  };


// =========================================================
// VALIDATE NORMAL GRN ITEMS
// =========================================================

const validateNormalGRNItems =
  async ({
    purchaseOrder,
    dispatch,
    items,
    excludeGrnId = null,
  }) => {

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      throw new Error(
        "At least one material is required for a GRN."
      );
    }


    const poItemMap =
      buildPOItemMap(
        purchaseOrder
      );


    // =====================================================
    // IMPORTANT:
    //
    // Use dispatch._id here.
    //
    // This prevents a previous GRN for Dispatch 1
    // from reducing the available quantity of Dispatch 2.
    // =====================================================

    const previousReceivedQuantities =
      await getPreviouslyReceivedQuantities(
        dispatch._id,
        excludeGrnId
      );


    const validatedItems = [];


    for (
      const inputItem of
      items
    ) {

      const materialId =
        toIdString(inputItem.material);


      if (!materialId) {
        throw new Error(
          "Material is required for every GRN item."
        );
      }


      const poItem =
        poItemMap[
          materialId
        ];


      if (!poItem) {
        throw new Error(
          `Material ${materialId} does not belong to this Purchase Order.`
        );
      }


      const dispatchItem =
        (dispatch.items || []).find(
          (item) =>
            toIdString(item.material) ===
              materialId &&
            !item.isReplacement
        );


      if (!dispatchItem) {
        throw new Error(
          `${poItem.materialName} was not included in this normal dispatch.`
        );
      }


      const dispatchedQuantity =
        Number(
          dispatchItem.dispatchQuantity || 0
        );


      const previouslyReceivedQuantity =
        Number(
          previousReceivedQuantities[
            materialId
          ] || 0
        );


      const receivedQuantity =
        Number(
          inputItem.receivedQuantity
        );


      if (
        !Number.isFinite(
          receivedQuantity
        ) ||
        receivedQuantity <= 0
      ) {
        throw new Error(
          `Invalid received quantity for ${poItem.materialName}.`
        );
      }


      const remainingDispatchQuantity =
        Math.max(
          dispatchedQuantity -
          previouslyReceivedQuantity,
          0
        );


      if (
        receivedQuantity >
        remainingDispatchQuantity
      ) {
        throw new Error(
          `${poItem.materialName}: received quantity ${receivedQuantity} exceeds remaining dispatch quantity ${remainingDispatchQuantity}.`
        );
      }


      const shortQuantity =
        Math.max(
          dispatchedQuantity -
          previouslyReceivedQuantity -
          receivedQuantity,
          0
        );


      const damageQuantity =
        Number(
          inputItem.damagedQuantity ||
          inputItem.damageQuantity ||
          0
        );


      const rejectedQuantity =
        Number(
          inputItem.rejectedQuantity ||
          0
        );


      if (
        damageQuantity < 0 ||
        rejectedQuantity < 0
      ) {
        throw new Error(
          `Invalid rejection/damage quantity for ${poItem.materialName}.`
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
          poItem.orderedQuantity,

        dispatchedQuantity,

        previouslyReceivedQuantity,

        receivedQuantity,

        totalReceivedQuantity:
          previouslyReceivedQuantity +
          receivedQuantity,

        shortQuantity,

        damageQuantity,

        rejectedQuantity,

        remainingQuantity:
          shortQuantity,

        remarks:
          inputItem.remarks ||
          "",
      });
    }


    return validatedItems;
  };


// =========================================================
// VALIDATE REPLACEMENT GRN ITEMS
// =========================================================

const validateReplacementGRNItems =
  async ({
    replacementRequest,
    replacementDispatch,
    items,
    excludeGrnId = null,
  }) => {

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      throw new Error(
        "At least one replacement material is required for a GRN."
      );
    }


    if (
      replacementDispatch.dispatchType !==
      "Replacement"
    ) {
      throw new Error(
        "Replacement GRN must reference a replacement dispatch."
      );
    }


    if (
      replacementDispatch.status !==
      "Delivered"
    ) {
      throw new Error(
        "Replacement Goods Receipt can only be created for a delivered replacement dispatch."
      );
    }


    const replacementRequestId =
      replacementRequest._id;


    const dispatchItemMap =
      buildReplacementDispatchItemMap(
        replacementDispatch,
        replacementRequestId
      );


    if (
      Object.keys(
        dispatchItemMap
      ).length === 0
    ) {
      throw new Error(
        "No replacement items belonging to this Replacement Request were found in the selected dispatch."
      );
    }


    const previousReceivedQuantities =
      await getPreviouslyReplacementReceivedQuantities(
        replacementRequestId,
        replacementDispatch._id,
        excludeGrnId
      );


    const validatedItems = [];


    for (
      const inputItem of
      items
    ) {

      const materialId =
        toIdString(inputItem.material);


      if (!materialId) {
        throw new Error(
          "Material is required for every replacement GRN item."
        );
      }


      const dispatchItem =
        dispatchItemMap[
          materialId
        ];


      if (!dispatchItem) {
        throw new Error(
          `Material ${materialId} was not dispatched as a replacement for this request.`
        );
      }


      const previouslyReceivedQuantity =
        Number(
          previousReceivedQuantities[
            materialId
          ] || 0
        );


      const receivedQuantity =
        Number(
          inputItem.receivedQuantity
        );


      if (
        !Number.isFinite(
          receivedQuantity
        ) ||
        receivedQuantity <= 0
      ) {
        throw new Error(
          `Invalid replacement received quantity for ${dispatchItem.materialName}.`
        );
      }


      const remainingReplacementQuantity =
        Math.max(
          dispatchItem.dispatchedQuantity -
          previouslyReceivedQuantity,
          0
        );


      if (
        receivedQuantity >
        remainingReplacementQuantity
      ) {
        throw new Error(
          `${dispatchItem.materialName}: replacement received quantity ${receivedQuantity} exceeds remaining replacement quantity ${remainingReplacementQuantity}.`
        );
      }


      const shortQuantity =
        Math.max(
          remainingReplacementQuantity -
          receivedQuantity,
          0
        );


      const damageQuantity =
        Number(
          inputItem.damagedQuantity ||
          inputItem.damageQuantity ||
          0
        );


      const rejectedQuantity =
        Number(
          inputItem.rejectedQuantity ||
          0
        );


      validatedItems.push({

        material:
          materialId,

        materialCode:
          dispatchItem.materialCode,

        materialName:
          dispatchItem.materialName,

        unitOfMeasure:
          dispatchItem.unitOfMeasure,

        orderedQuantity:
          dispatchItem.dispatchedQuantity,

        dispatchedQuantity:
          dispatchItem.dispatchedQuantity,

        previouslyReceivedQuantity,

        receivedQuantity,

        totalReceivedQuantity:
          previouslyReceivedQuantity +
          receivedQuantity,

        shortQuantity,

        damageQuantity,

        rejectedQuantity,

        remainingQuantity:
          shortQuantity,

        remarks:
          inputItem.remarks ||
          "",
      });
    }


    return validatedItems;
  };

// =========================================================
// SYNC REPLACEMENT GOODS RECEIPT
// =========================================================
//
// Replacement GRN
//       â†“
// ReplacementRequest
//       â†“
// replacementReceivedQuantity
// inspectionPendingQuantity
// receiptHistory
//
// IMPORTANT:
// - This updates quantities PER MATERIAL.
// - replacementPendingQuantity is NOT reduced here.
//   That field represents quantity still pending dispatch.
// - inspectionPendingQuantity represents received quantity
//   waiting for Quality Inspection.
// =========================================================

const syncReplacementGoodsReceipt =
  async ({
    replacementRequestId,
    goodsReceipt,
    userId,
  }) => {

    if (
      !replacementRequestId ||
      !isValidObjectId(
        replacementRequestId
      )
    ) {
      throw new Error(
        "Invalid Replacement Request ID."
      );
    }


    if (!goodsReceipt) {
      throw new Error(
        "Goods Receipt information is required."
      );
    }


    const replacementRequest =
      await ReplacementRequest.findOne({

        _id:
          replacementRequestId,

        isDeleted:
          false,

      });


    if (!replacementRequest) {
      throw new Error(
        "Replacement Request not found while synchronizing Goods Receipt."
      );
    }


    // =======================================================
    // UPDATE EACH REPLACEMENT ITEM
    // =======================================================

    for (
      const receiptItem of
      goodsReceipt.items || []
    ) {

      if (
        !receiptItem.material
      ) {
        continue;
      }


      const materialId =
        toIdString(receiptItem.material);


      const requestItem =
        replacementRequest.items.find(
          (item) =>
            toIdString(item.material) ===
              materialId
        );


      if (!requestItem) {
        throw new Error(
          `Material ${receiptItem.materialName || materialId} does not belong to this Replacement Request.`
        );
      }


      const receivedQuantity =
        Number(
          receiptItem.receivedQuantity || 0
        );


      if (
        receivedQuantity <= 0
      ) {
        continue;
      }


      // =====================================================
      // RECEIVED QUANTITY
      // =====================================================

      requestItem.replacementReceivedQuantity =
        Number(
          requestItem.replacementReceivedQuantity ||
          0
        ) +
        receivedQuantity;


      // =====================================================
      // INSPECTION PENDING
      // =====================================================

      requestItem.inspectionPendingQuantity =
        Number(
          requestItem.inspectionPendingQuantity ||
          0
        ) +
        receivedQuantity;
    }


    // =======================================================
    // TOTAL REQUEST-LEVEL QUANTITIES
    // =======================================================

    const totalReceived =
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


    const totalInspectionPending =
      replacementRequest.items.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.inspectionPendingQuantity ||
            0
          ),
        0
      );


    // =======================================================
    // ADD RECEIPT HISTORY
    // =======================================================

    if (
      !Array.isArray(
        replacementRequest.receiptHistory
      )
    ) {
      replacementRequest.receiptHistory = [];
    }


    const receiptHistoryItems =
      (goodsReceipt.items || []).map(
        (item) => ({

          material:
            item.material,

          materialCode:
            item.materialCode ||
            "",

          materialName:
            item.materialName ||
            "",

          dispatchedQuantity:
            Number(
              item.dispatchedQuantity ||
              0
            ),

          receivedQuantity:
            Number(
              item.receivedQuantity ||
              0
            ),

          shortQuantity:
            Number(
              item.shortQuantity ||
              0
            ),

          remarks:
            item.remarks ||
            "",
        })
      );


    replacementRequest.receiptHistory.push({

      goodsReceipt:
        goodsReceipt._id,

      grnNumber:
        goodsReceipt.grnNumber ||
        "",

      dispatch:
        goodsReceipt.dispatch,

      receiptDate:
        goodsReceipt.receiptDate ||
        new Date(),

      items:
        receiptHistoryItems,

      receivedBy:
        userId ||
        goodsReceipt.receivedBy ||
        null,

      remarks:
        goodsReceipt.remarks ||
        "",

      createdAt:
        new Date(),
    });


    // =======================================================
    // LINK LATEST GRN
    // =======================================================

    replacementRequest.goodsReceipt =
      goodsReceipt._id;


    // =======================================================
    // LINK USER
    // =======================================================

    replacementRequest.updatedBy =
      userId ||
      goodsReceipt.receivedBy ||
      null;


    // =======================================================
    // STATUS
    // =======================================================
    //
    // Do NOT mark the replacement request Completed here.
    //
    // It must go:
    //
    // GRN
    //   â†“
    // Quality Inspection
    //   â†“
    // Accepted
    //   â†“
    // Completion
    //
    // =======================================================

    if (
      totalInspectionPending > 0
    ) {

      replacementRequest.status =
        "Replacement Received";
    }


    await replacementRequest.save();


    return replacementRequest;
  };
// =========================================================
// GENERATE GRN NUMBER
// =========================================================

const generateGRNNumber =
  async () => {

    const lastReceipt =
      await GoodsReceipt.findOne()
        .sort({
          // GRN numbers are fixed-width, so sorting by the number itself
          // reliably finds the highest issued GRN.  Sorting by createdAt
          // can select an older number when historical data was inserted
          // out of sequence and causes a duplicate-key error.
          grnNumber: -1,
        })
        .select(
          "grnNumber"
        );


    let nextNumber = 1;


    if (
      lastReceipt?.grnNumber
    ) {

      const match =
        lastReceipt.grnNumber.match(
          /(\d+)$/
        );


      if (match) {

        nextNumber =
          Number(
            match[1]
          ) + 1;
      }
    }


    return `GRN-${String(
      nextNumber
    ).padStart(
      6,
      "0"
    )}`;
  };


// =========================================================
// GET ELIGIBLE DELIVERED DISPATCHES
// =========================================================
//
// Existing controller depends on this function.
//
// Only Delivered dispatches are returned.
//
// =========================================================

export const getEligibleDispatches =
  async () => {

    // A dispatch can produce one active GRN.  Do this filtering
    // server-side so a previously received replacement dispatch is not
    // offered again by the Goods Receipt screen.
    const activeReceiptDispatchIds =
      await GoodsReceipt.distinct(
        "dispatch",
        {
          isDeleted: false,
          status: {
            $ne: "Cancelled",
          },
        }
      );

    const dispatches =
      await Dispatch.find({

        status:
          "Delivered",

        isDeleted:
          false,

        _id: {
          $nin: activeReceiptDispatchIds,
        },
      })
        .populate(
          "purchaseOrder",
          "poNumber orderDate expectedDeliveryDate items status"
        )
        .populate(
          "vendor",
          "vendorCode vendorName email mobile phone"
        )
        .sort({
          updatedAt: -1,
        })
        .lean();


    return dispatches;
  };


// =========================================================
// CREATE GOODS RECEIPT
// =========================================================

export const createGoodsReceipt =
  async (
    data,
    userId
  ) => {

    if (!userId) {
      throw new Error(
        "User information is required."
      );
    }

    const {
      purchaseOrder,
      dispatch,
      receiptDate,
      department,
      receiptType =
        "Normal",
      replacementRequest =
        null,
      items,
      documents =
        [],
      remarks =
        "",
    } = data;

    if (!purchaseOrder) {
      throw new Error(
        "Purchase Order is required."
      );
    }

    if (!dispatch) {
      throw new Error(
        "Dispatch is required."
      );
    }

    const {
      purchaseOrder: po,
      dispatch: dispatchDocument,
    } =
      await validatePurchaseOrderAndDispatch({

        purchaseOrderId:
          purchaseOrder,

        dispatchId:
          dispatch,
      });


    // =======================================================
    // NORMAL GOODS RECEIPT
    // =======================================================

    if (
      receiptType ===
      "Normal"
    ) {

      if (
        dispatchDocument.status !==
        "Delivered"
      ) {
        throw new Error(
          "Goods Receipt can only be created for a delivered dispatch."
        );
      }

      if (
        dispatchDocument.dispatchType ===
        "Replacement"
      ) {
        throw new Error(
          "Replacement dispatch cannot be used for a normal Goods Receipt."
        );
      }


      const existingGRN =
        await GoodsReceipt.findOne({

          dispatch:
            dispatchDocument._id,

          receiptType:
            "Normal",

          isDeleted:
            false,

          status:
            {
              $in: [
                "Received",
                "Submitted",
                "Approved",
                "Quality Check",
                "Completed",
              ],
            },
        });


      if (existingGRN) {
        throw new Error(
          "A Goods Receipt already exists for this dispatch."
        );
      }


      const validatedItems =
        await validateNormalGRNItems({

          purchaseOrder:
            po,

          dispatch:
            dispatchDocument,

          items,

        });


      const grnNumber =
        await generateGRNNumber();


      const goodsReceipt =
        await GoodsReceipt.create({

          grnNumber,

          purchaseOrder:
            po._id,

          dispatch:
            dispatchDocument._id,

          vendor:
            po.vendor._id ||
            po.vendor,

          receiptDate:
            receiptDate ||
            new Date(),

          receivedBy:
            userId,

          department:
            department ||
            "",

          status:
            "Received",

          receiptType:
            "Normal",

          replacementRequest:
            null,

          items:
            validatedItems,

          documents,

          remarks,

          createdBy:
            userId,

          updatedBy:
            userId,

        });


      // Fire notification: Quality team
      createForRole(['SUPER_ADMIN', 'ADMIN', 'QUALITY_MANAGER'], {
        category: 'goods_receipt',
        priority: 'action',
        title: 'Quality Inspection Required',
        message: goodsReceipt.grnNumber + ' is ready for quality inspection. PO: ' + po.poNumber + '.',
        sourceModel: 'GoodsReceipt',
        sourceId: goodsReceipt._id,
        actionUrl: '/quality-inspection/inspections',
        actionLabel: 'Start Inspection',
      });
      // Fire notification: Vendor
      createForVendor(po.vendor._id || po.vendor, {
        category: 'goods_receipt',
        priority: 'info',
        title: 'Shipment Received by Buyer',
        message: goodsReceipt.grnNumber + ' has been created for ' + po.poNumber + '. Your shipment has been received.',
        sourceModel: 'GoodsReceipt',
        sourceId: goodsReceipt._id,
        actionUrl: '/vendor/purchase-orders/' + (po._id || po),
        actionLabel: 'View Purchase Order',
      });
      return goodsReceipt;
    }


    // =======================================================
    // REPLACEMENT GOODS RECEIPT
    // =======================================================

    if (
      receiptType ===
      "Replacement"
    ) {

      if (!replacementRequest) {
        throw new Error(
          "Replacement Request is required for a replacement Goods Receipt."
        );
      }


      const replacementRequestDocument =
        await getReplacementRequest(
          replacementRequest
        );


      if (
        replacementRequestDocument.purchaseOrder?._id?.toString() !==
        po._id.toString()
      ) {
        throw new Error(
          "Replacement Request does not belong to the selected Purchase Order."
        );
      }


      if (
        replacementRequestDocument.vendor?._id?.toString() !==
        po.vendor?._id?.toString()
      ) {
        throw new Error(
          "Replacement Request vendor does not match the Purchase Order vendor."
        );
      }


      if (
        replacementRequestDocument.status ===
        "Rejected"
      ) {
        throw new Error(
          "Rejected Replacement Requests cannot receive replacement material."
        );
      }


      if (
        replacementRequestDocument.status ===
        "Cancelled"
      ) {
        throw new Error(
          "Cancelled Replacement Requests cannot receive replacement material."
        );
      }

      // A replacement dispatch is received as one GRN. Without this
      // guard, a second submission reaches the quantity validator, which
      // has already counted the first GRN and reports a misleading
      // "remaining replacement quantity 0" error.
      const existingReplacementGRN =
        await GoodsReceipt.findOne({
          dispatch: dispatchDocument._id,
          receiptType: "Replacement",
          isDeleted: false,
          status: {
            $ne: "Cancelled",
          },
        }).select("grnNumber");

      if (existingReplacementGRN) {
        throw new Error(
          `A replacement Goods Receipt (${existingReplacementGRN.grnNumber}) already exists for this dispatch.`
        );
      }


      const replacementItemExists =
        dispatchDocument.items.some(
          (item) =>
            item.isReplacement &&
            item.replacementRequest &&
            item.replacementRequest.toString() ===
              replacementRequestDocument._id.toString()
        );


      if (
        !replacementItemExists
      ) {
        throw new Error(
          "The selected replacement dispatch is not linked to this Replacement Request."
        );
      }


      const validatedItems =
        await validateReplacementGRNItems({

          replacementRequest:
            replacementRequestDocument,

          replacementDispatch:
            dispatchDocument,

          items,

        });


      const grnNumber =
        await generateGRNNumber();


      const goodsReceipt =
        await GoodsReceipt.create({

          grnNumber,

          purchaseOrder:
            po._id,

          dispatch:
            dispatchDocument._id,

          vendor:
            po.vendor._id ||
            po.vendor,

          receiptDate:
            receiptDate ||
            new Date(),

          receivedBy:
            userId,

          department:
            department ||
            "",

          status:
            "Received",

          receiptType:
            "Replacement",

          replacementRequest:
            replacementRequestDocument._id,

          items:
            validatedItems,

          documents,

          remarks,

          createdBy:
            userId,

          updatedBy:
            userId,

        });


      // =====================================================
      // SYNC REPLACEMENT REQUEST
      // =====================================================

      await syncReplacementGoodsReceipt({

        replacementRequestId:
          replacementRequestDocument._id,

        goodsReceipt,

        userId,

      });


      return goodsReceipt;
    }


    // =======================================================
    // INVALID RECEIPT TYPE
    // =======================================================

    throw new Error(
      "Invalid Goods Receipt type."
    );
  };
// =========================================================
// SAVE DRAFT GOODS RECEIPT
// =========================================================

export const saveDraftGoodsReceipt =
  async (
    data,
    userId
  ) => {

    const {
      purchaseOrder,
      dispatch,
      receiptDate,
      department,
      receiptType =
        "Normal",
      replacementRequest =
        null,
      items =
        [],
      documents =
        [],
      remarks =
        "",
    } = data;


    const {
      purchaseOrder: po,
      dispatch: dispatchDocument,
    } =
      await validatePurchaseOrderAndDispatch({

        purchaseOrderId:
          purchaseOrder,

        dispatchId:
          dispatch,
      });


    let validatedItems = [];


    if (
      Array.isArray(items) &&
      items.length > 0
    ) {

      if (
        receiptType ===
        "Replacement"
      ) {

        if (!replacementRequest) {
          throw new Error(
            "Replacement Request is required for a replacement GRN draft."
          );
        }


        const replacementRequestDocument =
          await getReplacementRequest(
            replacementRequest
          );


        validatedItems =
          await validateReplacementGRNItems({

            replacementRequest:
              replacementRequestDocument,

            replacementDispatch:
              dispatchDocument,

            items,

          });

      } else {

        validatedItems =
          await validateNormalGRNItems({

            purchaseOrder:
              po,

            dispatch:
              dispatchDocument,

            items,

          });
      }
    }


    const grnNumber =
      await generateGRNNumber();


    const goodsReceipt =
      await GoodsReceipt.create({

        grnNumber,

        purchaseOrder:
          po._id,

        dispatch:
          dispatchDocument._id,

        vendor:
          po.vendor._id ||
          po.vendor,

        receiptDate:
          receiptDate ||
          new Date(),

        receivedBy:
          userId,

        department:
          department ||
          "",

        status:
          "Draft",

        receiptType,

        replacementRequest:
          replacementRequest ||
          null,

        items:
          validatedItems,

        documents,

        remarks,

        createdBy:
          userId,

        updatedBy:
          userId,
      });


    return goodsReceipt;
  };


// =========================================================
// UPDATE DRAFT GOODS RECEIPT
// =========================================================

export const updateGoodsReceipt =
  async (
    grnId,
    data,
    userId
  ) => {

    if (
      !isValidObjectId(grnId)
    ) {
      throw new Error(
        "Invalid Goods Receipt ID."
      );
    }


    const goodsReceipt =
      await GoodsReceipt.findOne({

        _id:
          grnId,

        isDeleted:
          false,
      });


    if (!goodsReceipt) {
      throw new Error(
        "Goods Receipt not found."
      );
    }


    if (
      goodsReceipt.status !==
      "Draft"
    ) {
      throw new Error(
        "Only Draft Goods Receipts can be edited."
      );
    }


    const {
      receiptDate,
      department,
      items,
      documents,
      remarks,
    } = data;


    if (
      items !== undefined
    ) {

      const {
        purchaseOrder,
        dispatch,
      } =
        await validatePurchaseOrderAndDispatch({

          purchaseOrderId:
            goodsReceipt.purchaseOrder,

          dispatchId:
            goodsReceipt.dispatch,
        });


      if (
        goodsReceipt.receiptType ===
        "Replacement"
      ) {

        if (
          !goodsReceipt.replacementRequest
        ) {
          throw new Error(
            "Replacement Request is missing from this replacement GRN."
          );
        }


        const replacementRequestDocument =
          await getReplacementRequest(
            goodsReceipt.replacementRequest
          );


        goodsReceipt.items =
          await validateReplacementGRNItems({

            replacementRequest:
              replacementRequestDocument,

            replacementDispatch:
              dispatch,

            items,

            excludeGrnId:
              goodsReceipt._id,

          });

      } else {

        goodsReceipt.items =
          await validateNormalGRNItems({

            purchaseOrder,

            dispatch,

            items,

            excludeGrnId:
              goodsReceipt._id,

          });
      }
    }


    if (
      receiptDate !==
      undefined
    ) {

      goodsReceipt.receiptDate =
        receiptDate;
    }


    if (
      department !==
      undefined
    ) {

      goodsReceipt.department =
        department;
    }


    if (
      documents !==
      undefined
    ) {

      goodsReceipt.documents =
        documents;
    }


    if (
      remarks !==
      undefined
    ) {

      goodsReceipt.remarks =
        remarks;
    }


    goodsReceipt.updatedBy =
      userId;


    await goodsReceipt.save();


    return goodsReceipt;
  };


// =========================================================
// SUBMIT GOODS RECEIPT
// =========================================================

export const submitGoodsReceipt =
  async (
    grnId,
    userId
  ) => {

    if (
      !isValidObjectId(grnId)
    ) {
      throw new Error(
        "Invalid Goods Receipt ID."
      );
    }


    const goodsReceipt =
      await GoodsReceipt.findOne({

        _id:
          grnId,

        isDeleted:
          false,
      });


    if (!goodsReceipt) {
      throw new Error(
        "Goods Receipt not found."
      );
    }


    if (
      goodsReceipt.status !==
      "Draft"
    ) {
      throw new Error(
        "Only Draft Goods Receipts can be submitted."
      );
    }


    if (
      !goodsReceipt.items ||
      goodsReceipt.items.length ===
        0
    ) {
      throw new Error(
        "At least one material is required before submitting the GRN."
      );
    }


    const {
      purchaseOrder,
      dispatch,
    } =
      await validatePurchaseOrderAndDispatch({

        purchaseOrderId:
          goodsReceipt.purchaseOrder,

        dispatchId:
          goodsReceipt.dispatch,
      });


    if (
      dispatch.status !==
      "Delivered"
    ) {
      throw new Error(
        "Goods Receipt can only be submitted for a delivered dispatch."
      );
    }


    if (
      goodsReceipt.receiptType ===
      "Replacement"
    ) {

      if (
        !goodsReceipt.replacementRequest
      ) {
        throw new Error(
          "Replacement Request is required for a replacement GRN."
        );
      }


      const replacementRequestDocument =
        await getReplacementRequest(
          goodsReceipt.replacementRequest
        );


      goodsReceipt.items =
        await validateReplacementGRNItems({

          replacementRequest:
            replacementRequestDocument,

          replacementDispatch:
            dispatch,

          items:
            goodsReceipt.items,

          excludeGrnId:
            goodsReceipt._id,

        });

    } else {

      goodsReceipt.items =
        await validateNormalGRNItems({

          purchaseOrder,

          dispatch,

          items:
            goodsReceipt.items,

          excludeGrnId:
            goodsReceipt._id,

        });
    }


    goodsReceipt.status =
      "Received";


    goodsReceipt.updatedBy =
      userId;


    await goodsReceipt.save();
    // =======================================================
// SYNC REPLACEMENT REQUEST AFTER SUBMIT
// =======================================================

if (
  goodsReceipt.receiptType ===
  "Replacement"
) {

  await syncReplacementGoodsReceipt({

    replacementRequestId:
      goodsReceipt.replacementRequest,

    goodsReceipt,

    userId,

  });

}


    return goodsReceipt;
  };


// =========================================================
// APPROVE GOODS RECEIPT
// =========================================================

export const approveGoodsReceipt =
  async (
    id,
    userId
  ) => {

    if (
      !isValidObjectId(id)
    ) {
      throw new Error(
        "Invalid Goods Receipt ID."
      );
    }


    const receipt =
      await GoodsReceipt.findOne({

        _id:
          id,

        isDeleted:
          false,
      });


    if (!receipt) {
      throw new Error(
        "Goods Receipt not found."
      );
    }


    if (
      receipt.status !==
      "Submitted"
    ) {
      throw new Error(
        `Only Submitted GRNs can be approved. Current status: "${receipt.status}".`
      );
    }


    receipt.status =
      "Approved";


    receipt.updatedBy =
      userId;


    await receipt.save();


    return receipt;
  };


// =========================================================
// GET ALL GOODS RECEIPTS
// =========================================================

export const getAllGoodsReceipts =
  async ({
    page = 1,
    limit = 10,
    search = "",
    status = "",
    receiptType = "",
    purchaseOrder = "",
  } = {}) => {

    const currentPage =
      Math.max(
        Number(page) || 1,
        1
      );


    const pageLimit =
      Math.max(
        Number(limit) || 10,
        1
      );


    const skip =
      (
        currentPage -
        1
      ) *
      pageLimit;


    const query = {

      isDeleted:
        false,
    };


    if (status) {

      query.status =
        status;
    }


    if (receiptType) {

      query.receiptType =
        receiptType;
    }


    if (purchaseOrder) {

      if (
        !isValidObjectId(
          purchaseOrder
        )
      ) {
        throw new Error(
          "Invalid Purchase Order ID."
        );
      }


      query.purchaseOrder =
        purchaseOrder;
    }


    if (search) {

      query.$or = [

        {
          grnNumber: {
            $regex:
              search,

            $options:
              "i",
          },
        },
      ];
    }


    const [
      goodsReceipts,
      total,
    ] =
      await Promise.all([

        GoodsReceipt.find(
          query
        )
          .populate(
            "purchaseOrder",
            "poNumber orderDate expectedDeliveryDate"
          )
          .populate(
            "vendor",
            "vendorCode vendorName"
          )
          .populate(
            "dispatch",
            "dispatchNumber dispatchDate status dispatchType"
          )
          .populate(
            "receivedBy",
            "name email role"
          )
          .populate(
            "replacementRequest",
            "requestNumber status requiredReplacementDate"
          )
          .sort({
            createdAt:
              -1,
          })
          .skip(
            skip
          )
          .limit(
            pageLimit
          )
          .lean(),

        GoodsReceipt.countDocuments(
          query
        ),
      ]);


    return {

      data:
        goodsReceipts,

      receipts:
        goodsReceipts,

      pagination: {

        page:
          currentPage,

        limit:
          pageLimit,

        total,

        totalPages:
          Math.ceil(
            total /
            pageLimit
          ),
      },

      total,

      page:
        currentPage,

      pages:
        Math.ceil(
          total /
          pageLimit
        ),
    };
  };


// =========================================================
// GET GOODS RECEIPT BY ID
// =========================================================

export const getGoodsReceiptById =
  async (
    grnId
  ) => {

    if (
      !isValidObjectId(grnId)
    ) {
      throw new Error(
        "Invalid Goods Receipt ID."
      );
    }


    const goodsReceipt =
      await GoodsReceipt.findOne({

        _id:
          grnId,

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
          "dispatch"
        )
        .populate(
          "receivedBy",
          "name email role"
        )
        .populate(
          "replacementRequest"
        )
        .populate(
          "items.material"
        );


    if (!goodsReceipt) {
      throw new Error(
        "Goods Receipt not found."
      );
    }


    return goodsReceipt;
  };


// =========================================================
// GET PO RECEIPT HISTORY
// =========================================================

export const getPOReceiptHistory =
  async (
    purchaseOrderId
  ) => {

    if (
      !isValidObjectId(
        purchaseOrderId
      )
    ) {
      throw new Error(
        "Invalid Purchase Order ID."
      );
    }


    const receipts =
      await GoodsReceipt.find({

        purchaseOrder:
          purchaseOrderId,

        isDeleted:
          false,
      })
        .populate(
          "dispatch",
          "dispatchNumber dispatchType status dispatchDate expectedDeliveryDate"
        )
        .populate(
          "replacementRequest",
          "requestNumber status requiredReplacementDate"
        )
        .populate(
          "vendor",
          "vendorCode vendorName"
        )
        .sort({
          receiptDate:
            1,
        })
        .lean();


    return receipts;
  };


// =========================================================
// BACKWARD-COMPATIBLE ALIAS
// =========================================================

export const getPurchaseOrderReceiptHistory =
  getPOReceiptHistory;


// =========================================================
// GET REPLACEMENT RECEIPT HISTORY
// =========================================================

export const getReplacementReceiptHistory =
  async (
    replacementRequestId
  ) => {

    if (
      !isValidObjectId(
        replacementRequestId
      )
    ) {
      throw new Error(
        "Invalid Replacement Request ID."
      );
    }


    const receipts =
      await GoodsReceipt.find({

        replacementRequest:
          replacementRequestId,

        receiptType:
          "Replacement",

        isDeleted:
          false,
      })
        .populate(
          "dispatch",
          "dispatchNumber dispatchType status dispatchDate expectedDeliveryDate"
        )
        .populate(
          "replacementRequest",
          "requestNumber status requiredReplacementDate"
        )
        .populate(
          "purchaseOrder",
          "poNumber status"
        )
        .populate(
          "vendor",
          "vendorCode vendorName"
        )
        .populate(
          "items.material",
          "materialCode materialName unitOfMeasure"
        )
        .sort({
          receiptDate:
            1,
        })
        .lean();


    return receipts;
  };
