import ReInspection from "../models/ReInspection.js";
import QualityInspection from "../models/QualityInspection.js";
import GoodsReceipt from "../models/GoodsReceipt.js";
import ReplacementRequest from "../models/ReplacementRequest.js";

const getId = (value) => value?._id || value;

const toIdString = (value) => String(getId(value) || "");

const getReplacementSourceItems = async (receipt) => {
  const reInspectedItems = await ReInspection.aggregate([
    {
      $match: {
        goodsReceipt: receipt._id,
        reinspectionType: "REPLACEMENT_MATERIAL",
        status: { $in: ["Draft", "In Progress", "Completed"] },
      },
    },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.material",
        reInspectedQuantity: { $sum: "$items.inspectionQuantity" },
      },
    },
  ]);

  const reInspectedByMaterial = new Map(
    reInspectedItems.map((item) => [
      toIdString(item._id),
      Number(item.reInspectedQuantity || 0),
    ])
  );

  return (receipt.items || []).map((item) => {
    const receivedQuantity = Number(item.receivedQuantity || 0);
    const previouslyReInspectedQuantity =
      reInspectedByMaterial.get(toIdString(item.material)) || 0;

    return {
      ...(item.toObject?.() || item),
      receivedQuantity,
      previouslyReInspectedQuantity,
      availableQuantity: Math.max(
        0,
        receivedQuantity - previouslyReInspectedQuantity
      ),
    };
  });
};

const buildItems = (items, sourceItems) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("At least one material is required for re-inspection.");
  }

  const sourceByMaterial = new Map(
    (sourceItems || []).map((item) => [toIdString(item.material), item])
  );
  const selectedMaterials = new Set();

  return items.map((item) => {
    const materialId = toIdString(item.material);
    const sourceItem = sourceByMaterial.get(materialId);
    const inspectionQuantity = Number(item.inspectionQuantity || 0);

    if (!sourceItem || selectedMaterials.has(materialId)) {
      throw new Error("Selected re-inspection material is not eligible.");
    }

    const availableQuantity = Number(sourceItem.availableQuantity || 0);
    if (!Number.isFinite(inspectionQuantity) || inspectionQuantity <= 0 || inspectionQuantity > availableQuantity) {
      throw new Error(`Re-inspection quantity must be between 1 and ${availableQuantity} for ${sourceItem.materialName}.`);
    }

    selectedMaterials.add(materialId);

    return {
      material: getId(sourceItem.material),
      materialCode: sourceItem.materialCode || "",
      materialName: sourceItem.materialName,
      inspectionQuantity,
      acceptedQuantity: 0,
      rejectedQuantity: 0,
      damagedQuantity: 0,
      remarks: item.remarks?.trim() || "",
    };
  });
};


// =========================================================
// CREATE RE-INSPECTION
// =========================================================

export const createReInspection = async (
  data,
  userId
) => {

  const {
    originalInspection,
    reinspectionType,
    reason,
    goodsReceipt: requestedGoodsReceipt,
    items: requestedItems,
  } = data;


  // -------------------------------------------------------
  // VALIDATION
  // -------------------------------------------------------

  if (!originalInspection) {

    throw new Error(
      "Original Quality Inspection is required."
    );

  }


  if (!reinspectionType) {

    throw new Error(
      "Re-inspection type is required."
    );

  }

  if (![
    "ORIGINAL_MATERIAL",
    "REPLACEMENT_MATERIAL",
  ].includes(reinspectionType)) {
    throw new Error("Invalid re-inspection type.");
  }


  if (!reason || !reason.trim()) {

    throw new Error(
      "Re-inspection reason is required."
    );

  }


  if (!userId) {

    throw new Error(
      "User information is required."
    );

  }


  // -------------------------------------------------------
  // GET ORIGINAL INSPECTION
  // -------------------------------------------------------

  const inspection =
    await QualityInspection
      .findById(originalInspection)
      .populate("goodsReceipt")
      .populate("purchaseOrder")
      .populate("vendor");


  if (!inspection) {

    throw new Error(
      "Original Quality Inspection not found."
    );

  }


  // -------------------------------------------------------
  // ORIGINAL INSPECTION VALIDATION
  // -------------------------------------------------------

  if (
    inspection.status !== "Completed"
  ) {

    throw new Error(
      "Only a completed Quality Inspection can be re-inspected."
    );

  }


  // -------------------------------------------------------
  // PREVENT DUPLICATE ACTIVE RE-INSPECTION
  // -------------------------------------------------------

  const existing =
    await ReInspection.findOne({
      originalInspection:
        inspection._id,

      reinspectionType,

      status: {
        $in: [
          "Draft",
          "In Progress",
        ],
      },
    });


  if (existing) {

    throw new Error(
      "An active re-inspection already exists for this Quality Inspection."
    );

  }


  let goodsReceipt = getId(inspection.goodsReceipt);
  let sourceItems = [];

  if (reinspectionType === "ORIGINAL_MATERIAL") {
    sourceItems = (inspection.items || []).map((item) => ({
      ...item.toObject?.() || item,
      availableQuantity: Number(item.rejectedQuantity || 0) + Number(item.damagedQuantity || 0),
    }));
  } else {
    if (!requestedGoodsReceipt) {
      throw new Error("A received replacement GRN is required for replacement-material re-inspection.");
    }

    const replacementRequest = await ReplacementRequest.findOne({
      qualityInspection: inspection._id,
      isDeleted: false,
    });

    if (!replacementRequest) {
      throw new Error("No replacement request exists for this Quality Inspection.");
    }

    const replacementReceipt = await GoodsReceipt.findOne({
      _id: requestedGoodsReceipt,
      receiptType: "Replacement",
      replacementRequest: replacementRequest._id,
      status: { $in: ["Received", "Quality Check", "Completed"] },
      isDeleted: false,
    });

    if (!replacementReceipt) {
      throw new Error("Selected GRN is not a received replacement material for this Quality Inspection.");
    }

    goodsReceipt = replacementReceipt._id;
    sourceItems = await getReplacementSourceItems(replacementReceipt);
  }

  const items = buildItems(requestedItems, sourceItems);


  // -------------------------------------------------------
  // CREATE RE-INSPECTION
  // -------------------------------------------------------

  const reInspection =
    await ReInspection.create({

      originalInspection:
        inspection._id,

      reinspectionType,

      goodsReceipt,

      purchaseOrder:
        inspection.purchaseOrder?._id ||
        inspection.purchaseOrder,

      vendor:
        inspection.vendor?._id ||
        inspection.vendor,

      reason:
        reason.trim(),

      items,

      overallResult:
        "Pending",

      status:
        "Draft",

      createdBy:
        userId,

    });


  // -------------------------------------------------------
  // RETURN POPULATED RECORD
  // -------------------------------------------------------

  return await ReInspection
    .findById(reInspection._id)
    .populate(
      "originalInspection"
    )
    .populate(
      "goodsReceipt"
    )
    .populate(
      "purchaseOrder"
    )
    .populate(
      "vendor"
    )
    .populate(
      "createdBy",
      "name email"
    );

};


// =========================================================
// GET ALL RE-INSPECTIONS
// =========================================================

export const getReInspections = async (
  filters = {}
) => {

  const query = {};


  if (filters.status) {

    query.status =
      filters.status;

  }


  if (filters.reinspectionType) {

    query.reinspectionType =
      filters.reinspectionType;

  }


  if (filters.originalInspection) {

    query.originalInspection =
      filters.originalInspection;

  }


  return await ReInspection
    .find(query)
    .populate(
      "originalInspection",
      "inspectionNumber status overallResult"
    )
    .populate(
      "goodsReceipt",
      "grnNumber"
    )
    .populate(
      "purchaseOrder",
      "poNumber"
    )
    .populate(
      "vendor",
      "vendorName companyName"
    )
    .populate(
      "createdBy",
      "name email"
    )
    .sort({
      createdAt: -1,
    });

};


// =========================================================
// GET ONE RE-INSPECTION
// =========================================================

export const getReInspectionById = async (
  id
) => {

  const reInspection =
    await ReInspection
      .findById(id)
      .populate(
        "originalInspection"
      )
      .populate(
        "goodsReceipt"
      )
      .populate(
        "purchaseOrder"
      )
      .populate(
        "vendor"
      )
      .populate(
        "createdBy",
        "name email"
      )
      .populate(
        "completedBy",
        "name email"
      );


  if (!reInspection) {

    throw new Error(
      "Re-inspection not found."
    );

  }


  return reInspection;

};


// =========================================================
// UPDATE DRAFT RE-INSPECTION
// =========================================================

export const updateReInspection = async (
  id,
  data
) => {

  const reInspection =
    await ReInspection
      .findById(id);


  if (!reInspection) {

    throw new Error(
      "Re-inspection not found."
    );

  }


  if (
    reInspection.status ===
    "Completed"
  ) {

    throw new Error(
      "Completed re-inspection cannot be edited."
    );

  }


  if (
    reInspection.status ===
    "Cancelled"
  ) {

    throw new Error(
      "Cancelled re-inspection cannot be edited."
    );

  }

  if (
    reInspection.reinspectionType === "REPLACEMENT_MATERIAL" &&
    Array.isArray(data.items)
  ) {
    const existingItems = new Map(
      reInspection.items.map((item) => [
        toIdString(item.material),
        Number(item.inspectionQuantity || 0),
      ])
    );

    const changesSourceQuantity =
      data.items.length !== reInspection.items.length ||
      data.items.some((item) => {
        const quantity = existingItems.get(toIdString(item.material));
        return quantity === undefined ||
          Number(item.inspectionQuantity || 0) !== quantity;
      });

    if (changesSourceQuantity) {
      throw new Error(
        "Replacement re-inspection materials and quantities cannot be changed after creation."
      );
    }
  }


  // -------------------------------------------------------
  // ALLOWED FIELDS
  // -------------------------------------------------------

  const allowedFields = [
    "reason",
    "items",
    "remarks",
    "overallResult",
  ];


  allowedFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      reInspection[field] = data[field];
    }
  });


  await reInspection.save();

  return await ReInspection.findById(reInspection._id)
    .populate("originalInspection")
    .populate("goodsReceipt")
    .populate("purchaseOrder")
    .populate("vendor")
    .populate("createdBy", "name email")
    .populate("completedBy", "name email");
};

// =========================================================
// COMPLETE RE-INSPECTION / FINAL DECISION
// =========================================================

export const completeReInspection = async (id, data, userId) => {
  const { overallResult, remarks } = data;

  if (!userId) {
    throw new Error("User information is required.");
  }

  const allowedResults = [
    "Accepted",
    "Partially Accepted",
    "Rejected",
    "Accepted with Damage",
    "Conditional Acceptance",
  ];

  if (!overallResult || !allowedResults.includes(overallResult)) {
    throw new Error("A valid final decision is required.");
  }

  if (
    overallResult === "Conditional Acceptance" &&
    (!remarks || !remarks.trim())
  ) {
    throw new Error("Remarks are required for Conditional Acceptance.");
  }

  const reInspection = await ReInspection.findById(id);

  if (!reInspection) {
    throw new Error("Re-inspection not found.");
  }

  if (reInspection.status === "Completed") {
    throw new Error("Re-inspection is already completed.");
  }

  if (reInspection.status === "Cancelled") {
    throw new Error("Cancelled re-inspection cannot be completed.");
  }

  if (!Array.isArray(reInspection.items) || reInspection.items.length === 0) {
    throw new Error("Re-inspection must contain at least one item.");
  }

  let totalInspectionQuantity = 0;
  let totalAcceptedQuantity = 0;
  let totalRejectedQuantity = 0;
  let totalDamagedQuantity = 0;

  for (const item of reInspection.items) {
    const inspectionQuantity = Number(item.inspectionQuantity || 0);
    const acceptedQuantity = Number(item.acceptedQuantity || 0);
    const rejectedQuantity = Number(item.rejectedQuantity || 0);
    const damagedQuantity = Number(item.damagedQuantity || 0);

    if (inspectionQuantity <= 0) {
      throw new Error(
        `Inspection quantity must be greater than zero for ${item.materialName || "the material"}.`
      );
    }

    if (acceptedQuantity < 0 || rejectedQuantity < 0 || damagedQuantity < 0) {
      throw new Error(
        `Inspection quantities cannot be negative for ${item.materialName || "the material"}.`
      );
    }

    const decidedQuantity = acceptedQuantity + rejectedQuantity + damagedQuantity;

    if (decidedQuantity > inspectionQuantity) {
      throw new Error(
        `Accepted + Rejected + Damaged quantity cannot exceed inspection quantity for ${item.materialName || "the material"}.`
      );
    }

    if (decidedQuantity < inspectionQuantity) {
      throw new Error(
        `All re-inspection quantity must be classified as Accepted, Rejected, or Damaged for ${item.materialName || "the material"}.`
      );
    }

    totalInspectionQuantity += inspectionQuantity;
    totalAcceptedQuantity += acceptedQuantity;
    totalRejectedQuantity += rejectedQuantity;
    totalDamagedQuantity += damagedQuantity;
  }

  if (
    overallResult === "Accepted" &&
    (totalRejectedQuantity > 0 || totalDamagedQuantity > 0)
  ) {
    throw new Error(
      "Final result cannot be Accepted when rejected or damaged quantity exists."
    );
  }

  if (
    overallResult === "Rejected" &&
    (totalAcceptedQuantity > 0 || totalDamagedQuantity > 0)
  ) {
    throw new Error(
      "Final result cannot be Rejected when accepted or damaged quantity exists."
    );
  }

  if (overallResult === "Accepted with Damage" && totalDamagedQuantity === 0) {
    throw new Error("Accepted with Damage requires damaged quantity.");
  }

  if (
    overallResult === "Partially Accepted" &&
    (totalAcceptedQuantity === 0 ||
      (totalRejectedQuantity === 0 && totalDamagedQuantity === 0))
  ) {
    throw new Error(
      "Partially Accepted requires accepted quantity and rejected or damaged quantity."
    );
  }

  // -------------------------------------------------------
  // SAVE FINAL DECISION
  // -------------------------------------------------------
  reInspection.overallResult = overallResult;
  reInspection.remarks = remarks?.trim() || "";
  reInspection.status = "Completed";
  reInspection.completedBy = userId;
  reInspection.completedAt = new Date();

  await reInspection.save();

  // -------------------------------------------------------
  // SYNC REPLACEMENT REQUEST
  // -------------------------------------------------------
  if (reInspection.reinspectionType === "REPLACEMENT_MATERIAL") {
    try {
      const replacementRequest = await ReplacementRequest.findOne({
        $or: [
          { qualityInspection: reInspection.originalInspection },
          { "receiptHistory.goodsReceipt": reInspection.goodsReceipt },
        ],
        isDeleted: false,
      });

      if (replacementRequest) {
        const prevStatus = replacementRequest.status;

        // Update item quantities
        for (const reItem of reInspection.items) {
          const repItem = replacementRequest.items.find(
            (i) => toIdString(i.material) === toIdString(reItem.material)
          );

          if (repItem) {
            repItem.replacementInspectedQuantity =
              (repItem.replacementInspectedQuantity || 0) +
              Number(reItem.inspectionQuantity || 0);
            repItem.replacementAcceptedQuantity =
              (repItem.replacementAcceptedQuantity || 0) +
              Number(reItem.acceptedQuantity || 0);
            repItem.replacementRejectedQuantity =
              (repItem.replacementRejectedQuantity || 0) +
              Number(reItem.rejectedQuantity || 0);
            repItem.replacementDamagedQuantity =
              (repItem.replacementDamagedQuantity || 0) +
              Number(reItem.damagedQuantity || 0);
            repItem.inspectionPendingQuantity = Math.max(
              0,
              (repItem.replacementReceivedQuantity || 0) -
                repItem.replacementInspectedQuantity
            );
          }
        }

        // Update inspection subdocument
        replacementRequest.replacementInspection = {
          inspectionNumber: reInspection.reInspectionNumber || reInspection._id.toString(),
          qualityInspection: reInspection.originalInspection,
          inspectionDate: reInspection.completedAt,
          overallResult,
          remarks: remarks?.trim() || "",
          inspectedBy: userId,
          completedAt: reInspection.completedAt,
          items: reInspection.items.map((it) => ({
            material: it.material,
            materialCode: it.materialCode,
            materialName: it.materialName,
            receivedQuantity: it.inspectionQuantity,
            inspectionQuantity: it.inspectionQuantity,
            acceptedQuantity: it.acceptedQuantity,
            rejectedQuantity: it.rejectedQuantity,
            damagedQuantity: it.damagedQuantity,
            pendingQuantity: 0,
            remarks: it.remarks || "",
          })),
        };

        // Determine updated status
        const allAccepted = replacementRequest.items.every(
          (i) => (i.replacementAcceptedQuantity || 0) >= (i.replacementQuantity || 0)
        );
        const hasRejections = replacementRequest.items.some(
          (i) => (i.replacementRejectedQuantity || 0) > 0 || (i.replacementDamagedQuantity || 0) > 0
        );

        let newStatus = "Inspection Completed";
        if (allAccepted) {
          newStatus = "Completed";
          replacementRequest.completedDate = new Date();
          replacementRequest.completion = {
            completedBy: userId,
            completedDate: new Date(),
            completionRemarks: "All replacement items inspected and accepted successfully.",
          };
        } else if (hasRejections) {
          newStatus = "Replacement Required";
        }

        replacementRequest.status = newStatus;
        replacementRequest.updatedBy = userId;

        replacementRequest.history.push({
          action: "RE_INSPECTION_COMPLETED",
          previousStatus: prevStatus,
          newStatus,
          performedBy: userId,
          performedAt: new Date(),
          remarks: `Re-inspection completed with result "${overallResult}". Accepted: ${totalAcceptedQuantity}, Rejected: ${totalRejectedQuantity}, Damaged: ${totalDamagedQuantity}.`,
        });

        await replacementRequest.save();
      }
    } catch (syncErr) {
      console.error("Error syncing replacement request on re-inspection complete:", syncErr);
    }
  }

  // -------------------------------------------------------
  // RETURN COMPLETED RECORD
  // -------------------------------------------------------
  return await ReInspection.findById(reInspection._id)
    .populate("originalInspection")
    .populate("goodsReceipt")
    .populate("purchaseOrder")
    .populate("vendor")
    .populate("createdBy", "name email")
    .populate("completedBy", "name email");
};

// =========================================================
// GET RE-INSPECTION HISTORY
// =========================================================

export const getReInspectionHistory = async (originalInspectionId) => {
  if (!originalInspectionId) {
    throw new Error("Original Quality Inspection is required.");
  }

  const history = await ReInspection.find({
    originalInspection: originalInspectionId,
  })
    .populate("originalInspection", "inspectionNumber status overallResult")
    .populate("goodsReceipt", "grnNumber")
    .populate("purchaseOrder", "poNumber")
    .populate("vendor", "vendorName companyName")
    .populate("createdBy", "name email")
    .populate("completedBy", "name email")
    .sort({ createdAt: 1 });

  return history;
};

// =========================================================
// GET RECEIVED REPLACEMENT GRNS FOR AN ORIGINAL INSPECTION
// =========================================================

export const getEligibleReplacementReceipts = async (originalInspectionId) => {
  const inspection = await QualityInspection.findById(originalInspectionId);

  if (!inspection) {
    throw new Error("Original Quality Inspection not found.");
  }

  const replacementRequest = await ReplacementRequest.findOne({
    qualityInspection: inspection._id,
    isDeleted: false,
  });

  if (!replacementRequest) {
    return [];
  }

  const receipts = await GoodsReceipt.find({
    receiptType: "Replacement",
    replacementRequest: replacementRequest._id,
    status: { $in: ["Received", "Quality Check", "Completed"] },
    isDeleted: false,
  }).select("grnNumber receiptDate items").sort({ receiptDate: -1 });

  const receiptSummaries = await Promise.all(
    receipts.map(async (receipt) => ({
      _id: receipt._id,
      grnNumber: receipt.grnNumber,
      receiptDate: receipt.receiptDate,
      items: (await getReplacementSourceItems(receipt))
        .map((item) => ({
          material: item.material,
          materialCode: item.materialCode,
          materialName: item.materialName,
          receivedQuantity: item.receivedQuantity,
          previouslyReInspectedQuantity:
            item.previouslyReInspectedQuantity,
          availableQuantity: item.availableQuantity,
        }))
        .filter((item) => item.availableQuantity > 0),
    }))
  );

  return receiptSummaries.filter((receipt) => receipt.items.length > 0);
};
