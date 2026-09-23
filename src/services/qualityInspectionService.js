
// backend/src/services/qualityInspectionService.js

import mongoose from "mongoose";

import QualityInspection from "../models/QualityInspection.js";
import GoodsReceipt from "../models/GoodsReceipt.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import Dispatch from "../models/Dispatch.js";
import ReplacementRequest from "../models/ReplacementRequest.js";
import ReInspection from "../models/ReInspection.js";
import MaterialCategory from "../models/MaterialCategory.js";
import Vendor from "../models/Vendor.js";
import User from "../models/User.js";
import Material from "../models/Material.js";
import { createForVendor, createForRole } from "./notificationService.js";

// =========================================================
// GENERATE INSPECTION NUMBER
// =========================================================

const generateInspectionNumber = async () => {

  const lastInspection =
    await QualityInspection
      .findOne({})
      .sort({
        // Inspection numbers are zero-padded, so sorting by the number
        // finds the highest issued value even when historical records
        // were created out of order.
        inspectionNumber: -1,
      })
      .select("inspectionNumber");

  let nextNumber = 1;

  if (lastInspection?.inspectionNumber) {

    const match =
      lastInspection.inspectionNumber.match(
        /(\d+)$/
      );

    if (match) {

      nextNumber =
        Number(match[1]) + 1;

    }

  }

  return `QI-${String(
    nextNumber
  ).padStart(6, "0")}`;

};
// =========================================================
// GET ELIGIBLE GOODS RECEIPTS
// =========================================================

export const getEligibleGoodsReceipts = async () => {
  const existingInspections = await QualityInspection.find({
    isDeleted: false,
  }).select("goodsReceipt");

  const existingGRNIds = existingInspections
    .map((i) => i.goodsReceipt)
    .filter(Boolean);

  const receipts = await GoodsReceipt.find({
    _id: { $nin: existingGRNIds },
    isDeleted: false,
    status: {
      $in: ["Received", "Quality Check"],
    },
    qualityInspection: null,
  })
    .populate("purchaseOrder", "poNumber orderDate expectedDeliveryDate status")
    .populate("dispatch", "dispatchNumber dispatchDate dispatchType status")
    .populate("vendor", "vendorCode vendorName email")
    .populate("items.material", "materialCode materialName uom")
    .sort({ receiptDate: -1 });

  return receipts;
};


// =========================================================
// GET GOODS RECEIPT FOR INSPECTION
// =========================================================

export const getGoodsReceiptForInspection =
  async (goodsReceiptId) => {

    if (
      !mongoose.Types.ObjectId.isValid(
        goodsReceiptId
      )
    ) {

      throw new Error(
        "Invalid Goods Receipt ID."
      );

    }


    const goodsReceipt =
      await GoodsReceipt.findOne({

        _id: goodsReceiptId,

        isDeleted: false,

      })

        .populate(
          "purchaseOrder"
        )

        .populate(
          "dispatch"
        )

        .populate(
          "vendor"
        )

        .populate(
          "replacementRequest"
        );


    if (!goodsReceipt) {

      throw new Error(
        "Goods Receipt not found."
      );

    }


    if (
      goodsReceipt.qualityInspection
    ) {

      const existingInspection =
        await QualityInspection.findById(
          goodsReceipt.qualityInspection
        );

      if (existingInspection) {

        throw new Error(
          "A Quality Inspection already exists for this Goods Receipt."
        );

      }

    }


    return goodsReceipt;

  };


// =========================================================
// BUILD INSPECTION ITEMS FROM GRN
// =========================================================

const buildInspectionItems =
  (goodsReceipt) => {

    return goodsReceipt.items.map(
      (item) => ({

        material:
          item.material,

        materialCode:
          item.materialCode,

        materialName:
          item.materialName,

        unitOfMeasure:
          item.unitOfMeasure,

        orderedQuantity:
          item.orderedQuantity,

        receivedQuantity:
          item.receivedQuantity,

        previouslyInspectedQuantity:
          0,

        inspectionQuantity:
          item.receivedQuantity,

        acceptedQuantity:
          0,

        rejectedQuantity:
          0,

        damagedQuantity:
          0,

        // =================================================
        // SHORT QUANTITY
        // =================================================
        //
        // Short quantity is the quantity ordered but not
        // physically received.
        //
        // It is NOT part of receivedQuantity.
        //
        // The Quality Manager can enter this during the
        // inspection/replacement decision.

        inspectionShortQuantity:
          0,

        inspectionMethod:
          "100% Inspection",

        sampleQuantity:
          0,

        samplePassedQuantity:
          0,

        sampleFailedQuantity:
          0,

        result:
          "Accepted",

        replacementRequiredQuantity:
          0,

        replacementRequired:
          false,

        parameters: [],

        defects: [],

        remarks: "",

      })
    );

  };


// =========================================================
// CREATE QUALITY INSPECTION DRAFT
// =========================================================

export const createQualityInspection =
  async (
    goodsReceiptId,
    userId
  ) => {

    if (
      !mongoose.Types.ObjectId.isValid(
        goodsReceiptId
      )
    ) {

      throw new Error(
        "Invalid Goods Receipt ID."
      );

    }


    if (
      !mongoose.Types.ObjectId.isValid(
        userId
      )
    ) {

      throw new Error(
        "Invalid user ID."
      );

    }


    const goodsReceipt =
      await GoodsReceipt.findOne({

        _id: goodsReceiptId,

        isDeleted: false,

      });


    if (!goodsReceipt) {

      throw new Error(
        "Goods Receipt not found."
      );

    }


    if (
      ![
        "Received",
        "Quality Check",
      ].includes(
        goodsReceipt.status
      )
    ) {

      throw new Error(
        `Goods Receipt cannot be inspected while its status is "${goodsReceipt.status}".`
      );

    }


    if (
      goodsReceipt.qualityInspection
    ) {

      throw new Error(
        "A Quality Inspection already exists for this Goods Receipt."
      );

    }


    const existingInspection =
      await QualityInspection.findOne({

        goodsReceipt:
          goodsReceipt._id,

        isDeleted:
          false,

      });


    if (existingInspection) {
      if (!goodsReceipt.qualityInspection) {
        await GoodsReceipt.findByIdAndUpdate(goodsReceipt._id, {
          qualityInspection: existingInspection._id,
        });
      }
      return existingInspection;
    }


    const inspectionNumber =
      await generateInspectionNumber();


    const inspection =
      await QualityInspection.create({

        inspectionNumber,

        purchaseOrder:
          goodsReceipt.purchaseOrder,

        goodsReceipt:
          goodsReceipt._id,

        dispatch:
          goodsReceipt.dispatch,

        vendor:
          goodsReceipt.vendor,

        inspectionDate:
          new Date(),

        inspectedBy:
          userId,

        department:
          goodsReceipt.department ||
          "Quality",

        status:
          "Draft",

        currentStep:
          2,

        overallResult:
          "Accepted",

        items:
          buildInspectionItems(
            goodsReceipt
          ),

        replacementRequired:
  false,

replacementRequest:
  goodsReceipt.replacementRequest || null,

        isReinspection:
          false,

        originalInspection:
          null,

        documentationStatus:
          "Not Required",

        deviationRequired:
          false,

        deviationReason:
          "",

        deviationApproved:
          false,

        deviationApprovedBy:
          null,

        deviationApprovalDate:
          null,

        documents: [],

        remarks: "",

        createdBy:
          userId,

        updatedBy:
          userId,

      });


    goodsReceipt.qualityInspection =
      inspection._id;

    goodsReceipt.status =
      "Quality Check";

    goodsReceipt.updatedBy =
      userId;

    await goodsReceipt.save();


    const populatedInspection =
      await QualityInspection
        .findById(
          inspection._id
        )

        .populate(
          "purchaseOrder"
        )

        .populate(
          "goodsReceipt"
        )

        .populate(
          "dispatch"
        )

        .populate(
          "vendor"
        )

        .populate(
          "inspectedBy",
          "name email role"
        );


    return populatedInspection;

  };


// =========================================================
// GET ALL QUALITY INSPECTIONS
// =========================================================

export const getAllQualityInspections =
  async ({
    page = 1,
    limit = 10,
    search = "",
    status = "",
    result = "",
    vendor = "",
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
      (currentPage - 1) *
      pageLimit;


    const query = {
      isDeleted:
        false,
    };


    if (status) {

      query.status =
        status;

    }


    if (result) {

      query.overallResult =
        result;

    }


    if (vendor) {

      if (
        mongoose.Types.ObjectId.isValid(
          vendor
        )
      ) {

        query.vendor =
          vendor;

      }

    }


    if (
      search &&
      search.trim()
    ) {

      const searchRegex =
        new RegExp(
          search.trim(),
          "i"
        );

      query.$or = [
        {
          inspectionNumber:
            searchRegex,
        },
      ];

    }


    const [
      inspections,
      total,
    ] = await Promise.all([

      QualityInspection
        .find(query)

        .populate(
          "purchaseOrder",
          "poNumber"
        )

        .populate(
          "goodsReceipt",
          "grnNumber"
        )

        .populate(
          "dispatch",
          "dispatchNumber"
        )

        .populate(
          "vendor",
          "vendorCode vendorName"
        )

        .populate(
          "inspectedBy",
          "name email"
        )

        .sort({
          createdAt: -1,
        })

        .skip(skip)

        .limit(pageLimit),

      QualityInspection.countDocuments(
        query
      ),

    ]);


    return {

      data:
        inspections,

      pagination: {

        page:
          currentPage,

        limit:
          pageLimit,

        total,

        totalPages:
          Math.ceil(
            total / pageLimit
          ),

      },

    };

  };


// =========================================================
// GET QUALITY INSPECTION BY ID
// =========================================================

export const getQualityInspectionById =
  async (id) => {

    if (
      !mongoose.Types.ObjectId.isValid(
        id
      )
    ) {

      throw new Error(
        "Invalid Quality Inspection ID."
      );

    }


    const inspection =
      await QualityInspection
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
          "goodsReceipt"
        )

        .populate(
          "dispatch"
        )

        .populate(
          "vendor"
        )

        .populate(
          "inspectedBy",
          "name email role"
        )

        .populate(
          "replacementRequest"
        )

        .populate(
          "originalInspection"
        )

        .populate(
          "deviationApprovedBy",
          "name email role"
        );


    if (!inspection) {

      throw new Error(
        "Quality Inspection not found."
      );

    }


    return inspection;

  };


// =========================================================
// UPDATE QUALITY INSPECTION
// =========================================================

export const updateQualityInspection =
  async (
    id,
    updateData,
    userId
  ) => {

    if (
      !mongoose.Types.ObjectId.isValid(
        id
      )
    ) {

      throw new Error(
        "Invalid Quality Inspection ID."
      );

    }


    const inspection =
      await QualityInspection.findOne({

        _id:
          id,

        isDeleted:
          false,

      });


    if (!inspection) {

      throw new Error(
        "Quality Inspection not found."
      );

    }


    if (
      inspection.status !==
      "Draft"
    ) {

      throw new Error(
        "Only draft Quality Inspections can be updated."
      );

    }


    const protectedFields = [
      "_id",
      "inspectionNumber",
      "purchaseOrder",
      "goodsReceipt",
      "dispatch",
      "vendor",
      "createdBy",
      "createdAt",
      "isDeleted",
    ];


    for (
      const [key, value]
      of Object.entries(
        updateData || {}
      )
    ) {

      if (
        protectedFields.includes(
          key
        )
      ) {

        continue;

      }


      inspection[key] =
        value;

    }


    inspection.updatedBy =
      userId;


    await inspection.save();

    return getQualityInspectionById(
      inspection._id
    );

  };
// =========================================================
// SYNC REPLACEMENT QUALITY INSPECTION
// =========================================================
//
// Replacement GRN
//       ↓
// Quality Inspection
//       ↓
// ReplacementRequest
//
// Updates:
//
// replacementInspectedQuantity
// replacementAcceptedQuantity
// replacementRejectedQuantity
// replacementDamagedQuantity
// inspectionPendingQuantity
//
// =========================================================

const syncReplacementQualityInspection =
  async ({
    inspection,
    userId,
  }) => {

    if (
      !inspection?.replacementRequest
    ) {
      return null;
    }


    const replacementRequest =
      await ReplacementRequest.findOne({

        _id:
          inspection.replacementRequest,

        isDeleted:
          false,

      });


    if (!replacementRequest) {

      throw new Error(
        "Replacement Request not found while synchronizing Quality Inspection."
      );

    }


    // =======================================================
    // PROCESS EACH INSPECTION ITEM
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
        replacementRequest.items.find(
          (item) =>
            item.material &&
            item.material.toString() ===
              materialId
        );


      if (!requestItem) {

        throw new Error(
          `Material ${inspectionItem.materialName || materialId} does not belong to this Replacement Request.`
        );

      }


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
      // UPDATE INSPECTED
      // =====================================================

      requestItem.replacementInspectedQuantity =
        Number(
          requestItem.replacementInspectedQuantity ||
          0
        ) +
        inspectedQuantity;


      // =====================================================
      // UPDATE ACCEPTED
      // =====================================================

      requestItem.replacementAcceptedQuantity =
        Number(
          requestItem.replacementAcceptedQuantity ||
          0
        ) +
        acceptedQuantity;


      // =====================================================
      // UPDATE REJECTED
      // =====================================================

      requestItem.replacementRejectedQuantity =
        Number(
          requestItem.replacementRejectedQuantity ||
          0
        ) +
        rejectedQuantity;


      // =====================================================
      // UPDATE DAMAGED
      // =====================================================

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
    // CALCULATE TOTALS
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


    const totalInspected =
      replacementRequest.items.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.replacementInspectedQuantity ||
            0
          ),
        0
      );


    const totalAccepted =
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


    const totalRejected =
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


    const totalDamaged =
      replacementRequest.items.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.replacementDamagedQuantity ||
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
    // UPDATE REQUEST AUDIT
    // =======================================================

    replacementRequest.updatedBy =
      userId;


    // =======================================================
    // DETERMINE NEXT STATUS
    // =======================================================

    const totalApproved =
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


    const totalPendingDispatch =
      replacementRequest.items.reduce(
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
    // STILL WAITING FOR INSPECTION
    // =======================================================

    if (
      totalInspectionPending > 0
    ) {

      replacementRequest.status =
        "Replacement Received";

    }

    // =======================================================
    // EVERYTHING RECEIVED AND INSPECTED
    // =======================================================

    else if (
      totalInspected >=
      totalReceived &&
      totalReceived > 0
    ) {

      // -----------------------------------------------------
      // ALL APPROVED REPLACEMENT QUANTITY ACCEPTED
      // -----------------------------------------------------

      if (
        totalAccepted >=
        totalApproved &&
        totalRejected === 0 &&
        totalDamaged === 0 &&
        totalPendingDispatch === 0
      ) {

        replacementRequest.status =
          "Completed";

      }

      // -----------------------------------------------------
      // SOME MATERIAL STILL FAILED
      // -----------------------------------------------------

      else if (
        totalRejected > 0 ||
        totalDamaged > 0
      ) {

        replacementRequest.status =
          "Replacement Required";

      }

      // -----------------------------------------------------
      // INSPECTED BUT NOT YET FULLY ACCEPTED
      // -----------------------------------------------------

      else {

        replacementRequest.status =
          "Replacement Received";

      }

    }


    // =======================================================
    // SAVE
    // =======================================================

    await replacementRequest.save();


    return replacementRequest;
  };

// =========================================================
// COMPLETE QUALITY INSPECTION
// =========================================================

export const completeQualityInspection =
  async (
    id,
    userId
  ) => {

    if (
      !mongoose.Types.ObjectId.isValid(
        id
      )
    ) {

      throw new Error(
        "Invalid Quality Inspection ID."
      );

    }


    const inspection =
      await QualityInspection.findOne({

        _id:
          id,

        isDeleted:
          false,

      });


    if (!inspection) {

      throw new Error(
        "Quality Inspection not found."
      );

    }


    if (
      inspection.status !==
      "Draft"
    ) {

      throw new Error(
        "Only draft Quality Inspections can be completed."
      );

    }


    // =====================================================
    // VALIDATE INSPECTION ITEMS
    // =====================================================

    for (
      const item
      of inspection.items
    ) {

      const ordered =
        Number(
          item.orderedQuantity || 0
        );

      const received =
        Number(
          item.receivedQuantity || 0
        );

      const inspected =
        Number(
          item.inspectionQuantity || 0
        );

      const accepted =
        Number(
          item.acceptedQuantity || 0
        );

      const rejected =
        Number(
          item.rejectedQuantity || 0
        );

      const damaged =
        Number(
          item.damagedQuantity || 0
        );

      const short =
        Number(
          item.inspectionShortQuantity || 0
        );


      // ===================================================
      // BASIC QUANTITY VALIDATION
      // ===================================================

      if (
        received < 0 ||
        inspected < 0 ||
        accepted < 0 ||
        rejected < 0 ||
        damaged < 0 ||
        short < 0
      ) {

        throw new Error(
          `Invalid quantity values for ${item.materialName}.`
        );

      }


      // ===================================================
      // RECEIVED QUANTITY
      // ===================================================

      if (
        inspected >
        received
      ) {

        throw new Error(
          `Inspection quantity cannot exceed received quantity for ${item.materialName}.`
        );

      }


      // ===================================================
      // RECEIVED QUANTITY BREAKDOWN
      // ===================================================
      //
      // Short quantity is intentionally excluded.
      //
      // Short means ordered but not physically received.
      //
      // ===================================================

      if (
        accepted +
        rejected +
        damaged >
        inspected
      ) {

        throw new Error(
          `Accepted + Rejected + Damaged quantity cannot exceed inspection quantity for ${item.materialName}.`
        );

      }


      // ===================================================
      // SHORT QUANTITY VALIDATION
      // ===================================================
      //
      // Short quantity represents ordered quantity that was
      // not received.
      //
      // Therefore it cannot exceed:
      //
      // Ordered Quantity - Received Quantity
      //
      // ===================================================

      const maximumShortQuantity =
        Math.max(
          ordered -
          received,
          0
        );


      if (
        short >
        maximumShortQuantity
      ) {

        throw new Error(
          `Short quantity cannot exceed the undelivered quantity for ${item.materialName}.`
        );

      }


      // ===================================================
      // REPLACEMENT QUANTITY
      // ===================================================
      //
      // Replacement eligibility includes:
      //
      // Rejected
      // Damaged
      // Short
      //
      // But replacementRequiredQuantity remains the final
      // replacement decision.
      //
      // This allows partial replacement.
      //
      // ===================================================

      const maximumReplacementQuantity =
        rejected +
        damaged +
        short;


      const currentReplacementQuantity =
        Number(
          item.replacementRequiredQuantity || 0
        );


      if (
        currentReplacementQuantity < 0
      ) {

        throw new Error(
          `Replacement quantity cannot be negative for ${item.materialName}.`
        );

      }


      if (
        currentReplacementQuantity >
        maximumReplacementQuantity
      ) {

        throw new Error(
          `Replacement quantity cannot exceed rejected, damaged and short quantity for ${item.materialName}.`
        );

      }


      /*
       * If the Quality Manager has not explicitly selected
       * a replacement quantity, initialize it with the full
       * eligible replacement quantity.
       *
       * If a smaller quantity was selected, preserve it.
       */

      if (
        currentReplacementQuantity === 0 &&
        maximumReplacementQuantity > 0
      ) {

        item.replacementRequiredQuantity =
          maximumReplacementQuantity;

      }


      item.replacementRequired =
        Number(
          item.replacementRequiredQuantity || 0
        ) > 0;

    }


    // =====================================================
    // TOTALS
    // =====================================================

    const totalAccepted =
      inspection.items.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.acceptedQuantity || 0
          ),
        0
      );


    const totalRejected =
      inspection.items.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.rejectedQuantity || 0
          ),
        0
      );


    const totalDamaged =
      inspection.items.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.damagedQuantity || 0
          ),
        0
      );


    const totalShort =
      inspection.items.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.inspectionShortQuantity || 0
          ),
        0
      );


    const totalReplacement =
      inspection.items.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.replacementRequiredQuantity || 0
          ),
        0
      );


    // =====================================================
    // OVERALL RESULT
    // =====================================================

    if (
      inspection.deviationRequired === true &&
      inspection.deviationApproved === true
    ) {

      inspection.overallResult =
        "Conditional Acceptance";

    } else if (
      totalRejected === 0 &&
      totalDamaged === 0 &&
      totalShort === 0
    ) {

      inspection.overallResult =
        "Accepted";

    } else if (
      totalAccepted > 0 &&
      (
        totalRejected > 0 ||
        totalDamaged > 0 ||
        totalShort > 0
      )
    ) {

      inspection.overallResult =
        totalDamaged > 0
          ? "Accepted with Damage"
          : "Partially Accepted";

    } else {

      inspection.overallResult =
        "Rejected";

    }


    // =====================================================
    // SAVE TOTALS
    // =====================================================

    inspection.totalAcceptedQuantity =
      totalAccepted;

    inspection.totalRejectedQuantity =
      totalRejected;

    inspection.totalDamagedQuantity =
      totalDamaged;

    inspection.totalInspectionShortQuantity =
      totalShort;

    inspection.totalReplacementQuantity =
      totalReplacement;

    inspection.replacementRequired =
      totalReplacement > 0;

    inspection.status =
      "Completed";

    inspection.updatedBy =
      userId;


    await inspection.save();

    // =====================================================
// REPLACEMENT QUALITY INSPECTION SYNC
// =====================================================
//
// IMPORTANT:
// Synchronize only after the inspection is completed.
// Never synchronize during draft updates.
//

if (
  inspection.replacementRequest
) {

  await syncReplacementQualityInspection({

    inspection,

    userId,

  });

}


    // =====================================================
    // UPDATE GRN
    // =====================================================

    const goodsReceipt =
      await GoodsReceipt.findById(
        inspection.goodsReceipt
      );


    if (goodsReceipt) {

      goodsReceipt.status =
        "Completed";

      goodsReceipt.qualityInspection =
        inspection._id;

      goodsReceipt.updatedBy =
        userId;

      await goodsReceipt.save();

    }


    // 🔔 Notify vendor & admin of inspection outcome
    const hasRejections = (inspection.totalRejectedQuantity || 0) > 0 || (inspection.totalDamagedQuantity || 0) > 0;
    const prio = hasRejections ? "critical" : "info";
    const vendorMsg = hasRejections
      ? `${inspection.inspectionNumber} completed with ${inspection.totalRejectedQuantity || 0} rejected units. Review inspection results.`
      : `${inspection.inspectionNumber} completed. All items passed inspection.`;

    createForVendor(inspection.vendor, {
      category: "quality_inspection",
      priority: prio,
      title: hasRejections ? "Material Rejected in Quality Inspection" : "Quality Inspection Passed",
      message: vendorMsg,
      sourceModel: "QualityInspection",
      sourceId: inspection._id,
      actionUrl: "/vendor/purchase-orders",
      actionLabel: "View Inspection",
    });

    if (hasRejections) {
      createForRole(["SUPER_ADMIN", "ADMIN", "PURCHASE_MANAGER"], {
        category: "quality_inspection",
        priority: "critical",
        title: "Rejection in Quality Inspection",
        message: `${inspection.inspectionNumber} had rejections (${inspection.totalRejectedQuantity || 0} rejected). Replacement action may be required.`,
        sourceModel: "QualityInspection",
        sourceId: inspection._id,
        actionUrl: "/quality-inspection/inspections",
        actionLabel: "View Inspection",
      });
    }

    return getQualityInspectionById(
      inspection._id
    );

  };


// =========================================================
// GET QUALITY INSPECTIONS ELIGIBLE FOR REPLACEMENT
// =========================================================

export const getReplacementEligibleQualityInspections =
  async () => {

    const inspections =
      await QualityInspection
        .find({

          isDeleted:
            false,

          status:
            "Completed",

          replacementRequired:
            true,

          // A replacement GRN inspection is already linked to its
          // replacement request. It must be handled as a re-replacement
          // outcome, not offered as a new replacement request.
          replacementRequest:
            null,

        })

        .populate(
          "purchaseOrder"
        )

        .populate(
          "goodsReceipt"
        )

        .populate(
          "dispatch"
        )

        .populate(
          "vendor"
        )

        .populate(
          "inspectedBy",
          "name email role"
        )

        .populate(
          "replacementRequest"
        )

        .sort({
          createdAt: -1,
        });


    return inspections;

  };


// =========================================================
// GET QUALITY INSPECTION DASHBOARD SUMMARY
// =========================================================

export const getQualityInspectionDashboardSummary =
  async () => {

    const baseQuery = {
      isDeleted:
        false,
    };


    const [
      totalInspections,
      pendingInspections,
      completedInspections,
      acceptedInspections,
      partialAcceptedInspections,
      rejectedInspections,
      damageInspections,
      replacementInspections,
      reinspectionInspections,
    ] = await Promise.all([

      QualityInspection.countDocuments(
        baseQuery
      ),

      QualityInspection.countDocuments({
        ...baseQuery,

        status: {
          $in: [
            "Draft",
            "Submitted",
          ],
        },

        isReinspection:
          false,
      }),

      QualityInspection.countDocuments({
        ...baseQuery,

        status:
          "Completed",
      }),

      QualityInspection.countDocuments({
        ...baseQuery,

        status:
          "Completed",

        overallResult:
          "Accepted",
      }),

      QualityInspection.countDocuments({
        ...baseQuery,

        status:
          "Completed",

        overallResult:
          "Partially Accepted",
      }),

      QualityInspection.countDocuments({
        ...baseQuery,

        status:
          "Completed",

        overallResult:
          "Rejected",
      }),

      QualityInspection.countDocuments({
        ...baseQuery,

        status:
          "Completed",

        overallResult:
          "Accepted with Damage",
      }),

      QualityInspection.countDocuments({
        ...baseQuery,

        replacementRequired:
          true,
      }),

      QualityInspection.countDocuments({
        ...baseQuery,

        isReinspection:
          true,
      }),

    ]);


    const resultDistribution = {

      accepted:
        acceptedInspections,

      partialRejection:
        partialAcceptedInspections,

      fullRejection:
        rejectedInspections,

      damage:
        damageInspections,

    };


    return {

      summary: {

        totalInspections,

        pending:
          pendingInspections,

        completed:
          completedInspections,

        accepted:
          acceptedInspections,

        partialRejection:
          partialAcceptedInspections,

        fullRejection:
          rejectedInspections,

        damage:
          damageInspections,

        replacement:
          replacementInspections,

        reInspection:
          reinspectionInspections,

      },

      resultDistribution,

    };

  };


// =========================================================
// GET QUALITY INSPECTION HISTORY BY PO
// =========================================================

export const getPOQualityInspectionHistory =
  async (purchaseOrderId) => {

    if (
      !mongoose.Types.ObjectId.isValid(
        purchaseOrderId
      )
    ) {

      throw new Error(
        "Invalid Purchase Order ID."
      );

    }


    return QualityInspection
      .find({

        purchaseOrder:
          purchaseOrderId,

        isDeleted:
          false,

      })

      .populate(
        "goodsReceipt",
        "grnNumber receiptDate status"
      )

      .populate(
        "dispatch",
        "dispatchNumber dispatchType"
      )

      .populate(
        "vendor",
        "vendorCode vendorName"
      )

      .sort({
        createdAt: -1,
      });

  };


// =========================================================
// GET QUALITY INSPECTION HISTORY BY VENDOR
// =========================================================

export const getVendorQualityInspectionHistory =
  async (vendorId) => {

    if (
      !mongoose.Types.ObjectId.isValid(
        vendorId
      )
    ) {

      throw new Error(
        "Invalid Vendor ID."
      );

    }


    return QualityInspection
      .find({

        vendor:
          vendorId,

        isDeleted:
          false,

      })

      .populate(
        "purchaseOrder",
        "poNumber"
      )

      .populate(
        "goodsReceipt",
        "grnNumber"
      )

      .populate(
        "dispatch",
        "dispatchNumber"
      )

      .sort({
        createdAt: -1,
      });

  };


// =========================================================
// GET QUALITY INSPECTION ANALYTICS
// =========================================================

export const getQualityInspectionAnalytics = async ({
  timePeriod = "6m",
  vendorId,
  categoryId,
} = {}) => {
  const now = new Date();
  let startDate = null;
  let prevStartDate = null;
  let monthsCount = 6;

  if (timePeriod === "30d") {
    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    prevStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    monthsCount = 1;
  } else if (timePeriod === "3m") {
    startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    prevStartDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    monthsCount = 3;
  } else if (timePeriod === "6m") {
    startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    prevStartDate = new Date(now.getTime() - 360 * 24 * 60 * 60 * 1000);
    monthsCount = 6;
  } else if (timePeriod === "1y") {
    startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    prevStartDate = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
    monthsCount = 12;
  } else if (timePeriod === "all") {
    startDate = null;
    prevStartDate = null;
    monthsCount = 6;
  }

  const query = { isDeleted: false };
  if (startDate) {
    query.inspectionDate = { $gte: startDate };
  }
  if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) {
    query.vendor = new mongoose.Types.ObjectId(vendorId);
  }
  if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
    const matchingMaterials = await Material.find({
      category: categoryId,
      isDeleted: false,
    }).select("_id");
    const matIds = matchingMaterials.map((m) => m._id);
    query["items.material"] = { $in: matIds };
  }

  // Fetch Inspections
  const inspections = await QualityInspection.find(query)
    .populate("vendor", "vendorName companyName code")
    .populate({
      path: "items.material",
      select: "materialName materialCode category",
      populate: { path: "category", select: "categoryName categoryCode" },
    })
    .sort({ inspectionDate: 1 })
    .lean();

  const totalInspections = inspections.length;

  // Previous period count for trend comparison
  let prevPeriodCount = 0;
  if (startDate && prevStartDate) {
    const prevQuery = {
      ...query,
      inspectionDate: { $gte: prevStartDate, $lt: startDate },
    };
    prevPeriodCount = await QualityInspection.countDocuments(prevQuery);
  }
  const trendPercent =
    prevPeriodCount > 0
      ? Math.round(((totalInspections - prevPeriodCount) / prevPeriodCount) * 100)
      : 0;

  // Key Result Counts
  let acceptedCount = 0;
  let conditionalCount = 0;
  let rejectedCount = 0;
  let damageCount = 0;

  inspections.forEach((insp) => {
    const res = insp.overallResult;
    if (res === "Accepted") {
      acceptedCount++;
    } else if (
      res === "Conditional Acceptance" ||
      res === "Partially Accepted" ||
      res === "Accepted with Damage"
    ) {
      conditionalCount++;
      if (res === "Accepted with Damage") damageCount++;
    } else if (res === "Rejected") {
      rejectedCount++;
    }
  });

  const acceptedRate =
    totalInspections > 0 ? Math.round((acceptedCount / totalInspections) * 100) : 0;
  const conditionalRate =
    totalInspections > 0 ? Math.round((conditionalCount / totalInspections) * 100) : 0;
  const rejectedRate =
    totalInspections > 0 ? Math.round((rejectedCount / totalInspections) * 100) : 0;

  // Re-inspections query
  const reInspectionQuery = { isDeleted: false };
  if (startDate) reInspectionQuery.createdAt = { $gte: startDate };
  if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) {
    reInspectionQuery.vendor = new mongoose.Types.ObjectId(vendorId);
  }
  const reInspections = await ReInspection.find(reInspectionQuery).lean();
  const reInspectionCount = reInspections.length;
  const reInspectionRate =
    totalInspections > 0 ? Math.round((reInspectionCount / totalInspections) * 100) : 0;

  let rePassedCount = 0;
  let reFailedCount = 0;
  reInspections.forEach((r) => {
    if (
      r.overallResult === "Accepted" ||
      r.overallResult === "Partially Accepted" ||
      r.status === "Completed"
    ) {
      rePassedCount++;
    } else {
      reFailedCount++;
    }
  });

  // Replacements query
  const repQuery = { isDeleted: false };
  if (startDate) repQuery.createdAt = { $gte: startDate };
  if (vendorId && mongoose.Types.ObjectId.isValid(vendorId)) {
    repQuery.vendor = new mongoose.Types.ObjectId(vendorId);
  }
  const replacements = await ReplacementRequest.find(repQuery).lean();
  const replacementCount = replacements.length;
  const replacementRate =
    totalInspections > 0 ? Math.round((replacementCount / totalInspections) * 100) : 0;

  let repApproved = 0;
  let repRejected = 0;
  let repPending = 0;
  replacements.forEach((rep) => {
    const st = (rep.status || "").toLowerCase();
    if (st.includes("received") || st.includes("approved") || st.includes("completed")) {
      repApproved++;
    } else if (st.includes("rejected") || st.includes("cancelled")) {
      repRejected++;
    } else {
      repPending++;
    }
  });

  // Results Distribution for Donut Chart
  const resultsDistribution = [
    {
      name: "Accepted",
      value: acceptedCount,
      percentage: acceptedRate,
      color: "#10B981",
    },
    {
      name: "Conditional",
      value: conditionalCount,
      percentage: conditionalRate,
      color: "#F59E0B",
    },
    {
      name: "Rejected",
      value: rejectedCount,
      percentage: rejectedRate,
      color: "#EF4444",
    },
  ];

  // Monthly Quality Trend (last N months)
  const monthMap = {};
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const chartMonths = [];
  let endMonthDate = new Date();
  inspections.forEach((insp) => {
    const d = new Date(insp.inspectionDate || insp.createdAt);
    if (!isNaN(d.getTime()) && d > endMonthDate) {
      endMonthDate = d;
    }
  });

  for (let i = monthsCount - 1; i >= 0; i--) {
    const d = new Date(endMonthDate.getFullYear(), endMonthDate.getMonth() - i, 1);
    const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    chartMonths.push(label);
    monthMap[label] = { total: 0, accepted: 0, rejected: 0, defects: 0 };
  }

  inspections.forEach((insp) => {
    const d = new Date(insp.inspectionDate || insp.createdAt);
    if (!isNaN(d.getTime())) {
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      if (monthMap[label]) {
        monthMap[label].total++;
        if (insp.overallResult === "Accepted") monthMap[label].accepted++;
        if (insp.overallResult === "Rejected") monthMap[label].rejected++;
        const hasDefect = (insp.items || []).some(
          (item) => (item.defects || []).length > 0 || item.rejectedQuantity > 0 || item.damagedQuantity > 0
        );
        if (hasDefect) monthMap[label].defects++;
      }
    }
  });

  const monthlyTrends = chartMonths.map((m) => {
    const entry = monthMap[m];
    if (entry && entry.total > 0) {
      const aRate = Math.round((entry.accepted / entry.total) * 100);
      const rRate = Math.round((entry.rejected / entry.total) * 100);
      const dRate = Math.round((entry.defects / entry.total) * 100);
      return { month: m, acceptanceRate: aRate, rejectionRate: rRate, defectRate: dRate };
    }
    return { month: m, acceptanceRate: 0, rejectionRate: 0, defectRate: 0 };
  });

  // Top Defect Reasons
  const defectCounts = {
    "Dimensional Defect": 0,
    "Surface Damage": 0,
    "Material Defect": 0,
    "Wrong Specification": 0,
    "Quantity Damage": 0,
    "Other": 0,
  };

  inspections.forEach((insp) => {
    (insp.items || []).forEach((item) => {
      (item.defects || []).forEach((d) => {
        const cat = d.category || "";
        if (cat.includes("Dimensional")) defectCounts["Dimensional Defect"] += d.quantity || 1;
        else if (cat.includes("Visual") || cat.includes("Packaging"))
          defectCounts["Surface Damage"] += d.quantity || 1;
        else if (cat.includes("Material")) defectCounts["Material Defect"] += d.quantity || 1;
        else if (cat.includes("Documentation") || cat.includes("Specification"))
          defectCounts["Wrong Specification"] += d.quantity || 1;
        else if (cat.includes("Performance") || cat.includes("Functional"))
          defectCounts["Quantity Damage"] += d.quantity || 1;
        else defectCounts["Other"] += d.quantity || 1;
      });
      if (item.damagedQuantity > 0) {
        defectCounts["Surface Damage"] += item.damagedQuantity;
      }
    });
  });

  const topDefects = Object.entries(defectCounts).map(([name, count], index) => {
    const colors = ["#EF4444", "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#94A3B8"];
    return {
      reason: name,
      count,
      color: colors[index % colors.length],
    };
  });

  // Vendor Quality Performance Table
  const vendorMap = {};
  inspections.forEach((insp) => {
    const v = insp.vendor;
    if (!v) return;
    const vId = v._id.toString();
    if (!vendorMap[vId]) {
      vendorMap[vId] = {
        vendorId: vId,
        vendorName: v.vendorName || v.companyName || "Vendor " + (v.code || ""),
        inspections: 0,
        accepted: 0,
        rejected: 0,
        defects: 0,
        reInspections: 0,
      };
    }
    vendorMap[vId].inspections++;
    if (insp.overallResult === "Accepted") vendorMap[vId].accepted++;
    if (insp.overallResult === "Rejected") vendorMap[vId].rejected++;
    if (insp.isReinspection || insp.reinspectionRequired) vendorMap[vId].reInspections++;
    const hasDefect = (insp.items || []).some(
      (item) => (item.defects || []).length > 0 || item.rejectedQuantity > 0 || item.damagedQuantity > 0
    );
    if (hasDefect) vendorMap[vId].defects++;
  });

  let vendorPerformance = Object.values(vendorMap).map((item) => {
    const acceptedRate = item.inspections > 0 ? Math.round((item.accepted / item.inspections) * 100) : 0;
    const rejectedRate = item.inspections > 0 ? Math.round((item.rejected / item.inspections) * 100) : 0;
    const defectRate = item.inspections > 0 ? Math.round((item.defects / item.inspections) * 100 * 10) / 10 : 0;
    const qualityScore = item.inspections > 0 ? Math.round((item.accepted / item.inspections) * 100) : 0;
    const trend = qualityScore >= 80 ? "up" : "down";
    return {
      vendorId: item.vendorId,
      vendorName: item.vendorName,
      inspections: item.inspections,
      acceptedRate,
      rejectedRate,
      defectRate,
      reInspections: item.reInspections,
      qualityScore,
      trend,
    };
  });
  vendorPerformance.sort((a, b) => b.inspections - a.inspections);

  // Material-wise Rejection Analysis Table
  const materialMap = {};
  inspections.forEach((insp) => {
    (insp.items || []).forEach((item) => {
      const mName = item.materialName || item.material?.materialName || item.material?.name || "Standard Item";
      if (!materialMap[mName]) {
        materialMap[mName] = { material: mName, inspections: 0, rejected: 0, defects: 0 };
      }
      materialMap[mName].inspections++;
      if (item.rejectedQuantity > 0 || item.result === "Rejected") materialMap[mName].rejected++;
      if ((item.defects || []).length > 0 || item.damagedQuantity > 0) materialMap[mName].defects++;
    });
  });

  let materialRejections = Object.values(materialMap).map((m) => {
    const rejectionRate = m.inspections > 0 ? Math.round((m.rejected / m.inspections) * 100) : 0;
    const defectRate =
      m.inspections > 0 ? Math.round((m.defects / m.inspections) * 100 * 10) / 10 : 0;
    return {
      material: m.material,
      inspections: m.inspections,
      rejectionRate,
      defectRate,
    };
  });
  materialRejections.sort((a, b) => b.inspections - a.inspections);

  // Filter Dropdown Options
  const allVendors = await Vendor.find({ isDeleted: false })
    .select("_id vendorName companyName")
    .lean();
  const allCategories = await MaterialCategory.find({ isDeleted: false })
    .select("_id categoryName categoryCode")
    .lean();

  return {
    summary: {
      totalInspections,
      trendPercent,
      accepted: {
        count: acceptedCount,
        rate: acceptedRate,
      },
      conditionallyAccepted: {
        count: conditionalCount,
        rate: conditionalRate,
      },
      rejected: {
        count: rejectedCount,
        rate: rejectedRate,
      },
      reInspections: {
        count: reInspectionCount,
        rate: reInspectionRate,
      },
      replacementRequests: {
        count: replacementCount,
        rate: replacementRate,
      },
    },
    resultsDistribution,
    monthlyTrends,
    topDefects,
    vendorPerformance,
    materialRejections,
    reinspectionAnalysis: {
      total: reInspectionCount,
      passedAfterCorrection: rePassedCount,
      failedAgain: reFailedCount,
      passedRate:
        reInspectionCount > 0 ? Math.round((rePassedCount / reInspectionCount) * 100) : 0,
      failedRate:
        reInspectionCount > 0 ? Math.round((reFailedCount / reInspectionCount) * 100) : 0,
    },
    replacementAnalysis: {
      total: replacementCount,
      approved: repApproved,
      rejected: repRejected,
      pending: repPending,
      approvedRate:
        replacementCount > 0 ? Math.round((repApproved / replacementCount) * 100) : 0,
      rejectedRate:
        replacementCount > 0 ? Math.round((repRejected / replacementCount) * 100) : 0,
      pendingRate:
        replacementCount > 0 ? Math.round((repPending / replacementCount) * 100) : 0,
    },
    filterOptions: {
      vendors: allVendors.map((v) => ({
        _id: v._id,
        name: v.vendorName || v.companyName,
      })),
      categories: allCategories.map((c) => ({
        _id: c._id,
        name: c.categoryName || c.categoryCode || "Category",
      })),
    },
  };
};


// =========================================================
// EXPORTS
// =========================================================

export default {

  getEligibleGoodsReceipts,

  getGoodsReceiptForInspection,

  createQualityInspection,

  getAllQualityInspections,

  getReplacementEligibleQualityInspections,

  getQualityInspectionById,

  updateQualityInspection,

  completeQualityInspection,

  getPOQualityInspectionHistory,

  getVendorQualityInspectionHistory,

  getQualityInspectionDashboardSummary,

  getQualityInspectionAnalytics,

};
