import mongoose from "mongoose";
import PurchaseOrder from "../models/PurchaseOrder.js";
import Dispatch from "../models/Dispatch.js";
import GoodsReceipt from "../models/GoodsReceipt.js";
import QualityInspection from "../models/QualityInspection.js";
import ReInspection from "../models/ReInspection.js";
import ReplacementRequest from "../models/ReplacementRequest.js";
import Material from "../models/Material.js";
import VendorRating from "../models/VendorRating.js";
import Vendor from "../models/Vendor.js";
import User from "../models/User.js";
import { createForVendor } from "./notificationService.js";

/**
 * =========================================================
 * VENDOR RATING SERVICE
 * =========================================================
 *
 * 8 Weighted Parameters (Total 100%):
 *
 * 1. Delivery Performance      30%
 * 2. Quality Performance       25%
 * 3. Fulfillment                15%
 * 4. Price Competitiveness      10%
 * 5. Response Time               5%
 * 6. PO Acceptance               5%
 * 7. Documentation               5%
 * 8. Communication               5%
 *
 * Complaint is CONDITIONAL / Informational (not part of mandatory 100%).
 * Replacement and Re-Inspection are integrated supporting evidence.
 *
 * =========================================================
 */

// =========================================================
// CONSTANTS & WEIGHTS
// =========================================================

const WEIGHTS = {
  delivery: 30,
  quality: 25,
  fulfillment: 15,
  price: 10,
  responseTime: 5,
  poAcceptance: 5,
  documentation: 5,
  communication: 5,
};

// =========================================================
// MATH & DATE HELPERS
// =========================================================

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const round = (value, decimals = 2) => {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const multiplier = Math.pow(10, decimals);
  return Math.round(num * multiplier) / multiplier;
};

const clamp = (value, min = 0, max = 100) => {
  if (value === null || value === undefined) return null;
  const num = toNumber(value);
  return Math.min(max, Math.max(min, num));
};

const percentage = (numerator, denominator) => {
  const num = toNumber(numerator);
  const den = toNumber(denominator);
  if (den <= 0) return 0;
  return round((num / den) * 100);
};

const startOfDay = (date) => {
  if (!date) return null;
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return null;
  value.setHours(0, 0, 0, 0);
  return value;
};

const endOfDay = (date) => {
  if (!date) return null;
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return null;
  value.setHours(23, 59, 59, 999);
  return value;
};

const differenceInDays = (fromDate, toDate) => {
  if (!fromDate || !toDate) return 0;
  const from = new Date(fromDate);
  const to = new Date(toDate);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  const diffMs = to.getTime() - from.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

const differenceInMinutes = (fromDate, toDate) => {
  if (!fromDate || !toDate) return 0;
  const from = new Date(fromDate);
  const to = new Date(toDate);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  const diffMs = to.getTime() - from.getTime();
  return diffMs / (1000 * 60);
};

const getRatingCategory = (score) => {
  if (score === null || score === undefined) return null;
  const num = toNumber(score);
  if (num >= 95) return "Preferred Vendor";
  if (num >= 85) return "Excellent";
  if (num >= 70) return "Good";
  if (num >= 50) return "Average";
  return "Poor";
};

// =========================================================
// 1. DELIVERY SCORE (30% Overall Weight)
// =========================================================
/**
 * 6-Component Composite Delivery Performance (100 internal points):
 *  1. Delivery Timeliness                 45%
 *  2. Dispatch Adherence                  15%
 *  3. Delivery Completeness               15%
 *  4. Partial / Multi-Dispatch Perf       10%
 *  5. Pending / Overdue Delivery          10%
 *  6. Delivery Consistency                 5%
 *
 * Delay scale for Timeliness:
 *  - 0 days delay (on-time / early) = 100
 *  - 1 day delay = 90
 *  - 2 days delay = 80
 *  - 3 days delay = 70
 *  - 4 days delay = 60
 *  - 5+ days delay = 40
 */
const calculateDelivery = ({
  purchaseOrders,
  dispatches,
  goodsReceipts,
}) => {
  const normalDispatches = dispatches.filter(
    (d) => !d.isDeleted && d.dispatchType !== "Replacement"
  );

  const normalReceipts = goodsReceipts.filter(
    (r) => !r.isDeleted && r.receiptType === "Normal" && r.status !== "Cancelled"
  );

  let totalOrderedQuantity = 0;
  let totalDispatchedQuantity = 0;
  let totalReceivedQuantity = 0;
  let onTimeQuantity = 0;
  let delayedQuantity = 0;
  let totalDelayDays = 0;
  let partialDispatchCount = 0;
  const poDispatchMap = new Map();

  for (const po of purchaseOrders) {
    const ordered = (po.items || []).reduce(
      (sum, item) => sum + toNumber(item.quantity),
      0
    );
    totalOrderedQuantity += ordered;
  }

  for (const dispatch of normalDispatches) {
    const qty = (dispatch.items || []).reduce(
      (sum, item) => sum + toNumber(item.dispatchQuantity),
      0
    );
    totalDispatchedQuantity += qty;

    if (dispatch.dispatchType === "Partial") {
      partialDispatchCount += 1;
    }

    const poId = String(dispatch.purchaseOrder);
    poDispatchMap.set(poId, (poDispatchMap.get(poId) || 0) + 1);
  }

  let delayedReceipts = 0;
  let weightedScoreSum = 0;
  let totalScoreWeightQuantity = 0;
  const delayList = [];

  for (const receipt of normalReceipts) {
    const received = (receipt.items || []).reduce(
      (sum, item) => sum + toNumber(item.receivedQuantity),
      0
    );
    totalReceivedQuantity += received;

    const matchedDispatch = normalDispatches.find(
      (d) => String(d._id) === String(receipt.dispatch)
    );
    const matchedPO = purchaseOrders.find(
      (p) => String(p._id) === String(receipt.purchaseOrder)
    );

    // Primary benchmark: Dispatch.expectedDeliveryDate, fallback: PO.expectedDeliveryDate
    const expectedDate =
      matchedDispatch?.expectedDeliveryDate ||
      matchedPO?.expectedDeliveryDate;
    const actualDate = receipt.receiptDate;

    if (!expectedDate || !actualDate || received <= 0) {
      continue;
    }

    const rawDiffDays = differenceInDays(expectedDate, actualDate);
    const delay = Math.max(0, rawDiffDays);
    delayList.push(delay);

    if (delay <= 0) {
      onTimeQuantity += received;
    } else {
      delayedQuantity += received;
      delayedReceipts += 1;
      totalDelayDays += delay;
    }

    let score = 100;
    if (delay === 1) score = 90;
    else if (delay === 2) score = 80;
    else if (delay === 3) score = 70;
    else if (delay === 4) score = 60;
    else if (delay >= 5) score = 40;

    weightedScoreSum += received * score;
    totalScoreWeightQuantity += received;
  }

  const averageDelayDays =
    delayedReceipts > 0 ? round(totalDelayDays / delayedReceipts) : 0;

  let multipleDispatchPOCount = 0;
  for (const count of poDispatchMap.values()) {
    if (count > 1) multipleDispatchPOCount += 1;
  }

  // =========================================================
  // 6 COMPONENT CALCULATIONS (TOTAL 100 INTERNAL POINTS)
  // =========================================================

  // 1. Delivery Timeliness (45% internal weight)
  let rawTimeliness = 100;
  if (totalScoreWeightQuantity > 0) {
    rawTimeliness = clamp(round(weightedScoreSum / totalScoreWeightQuantity, 2));
  } else if (purchaseOrders.length > 0 && totalReceivedQuantity === 0) {
    rawTimeliness = 0;
  }
  const timelinessPoints = round(rawTimeliness * 0.45, 2);

  // 2. Dispatch Adherence (15% internal weight)
  let onScheduleDispatches = 0;
  for (const dispatch of normalDispatches) {
    const matchedPO = purchaseOrders.find(
      (p) => String(p._id) === String(dispatch.purchaseOrder)
    );
    const poCommitmentDate = matchedPO?.expectedDeliveryDate;
    if (dispatch.dispatchDate && poCommitmentDate) {
      if (new Date(dispatch.dispatchDate) <= new Date(poCommitmentDate)) {
        onScheduleDispatches += 1;
      }
    } else {
      onScheduleDispatches += 1;
    }
  }
  const rawDispatchAdherence =
    normalDispatches.length > 0
      ? clamp(round((onScheduleDispatches / normalDispatches.length) * 100, 2))
      : 100;
  const dispatchAdherencePoints = round(rawDispatchAdherence * 0.15, 2);

  // 3. Delivery Completeness (15% internal weight)
  let rawCompleteness = 100;
  if (totalOrderedQuantity > 0) {
    rawCompleteness = clamp(round((totalReceivedQuantity / totalOrderedQuantity) * 100, 2));
  }
  const completenessPoints = round(rawCompleteness * 0.15, 2);

  // 4. Partial / Multiple Dispatch Performance (10% internal weight)
  let partialPenalty = 0;
  for (const dispatch of normalDispatches) {
    if (dispatch.dispatchType === "Partial") {
      if (
        ["Stock Shortage", "Production Delay", "Raw Material Shortage", "Quality Issue"].includes(
          dispatch.partialDispatchReason
        )
      ) {
        partialPenalty += 5;
      }
    }
  }
  const rawPartialPerformance = clamp(100 - partialPenalty, 40, 100);
  const partialPerformancePoints = round(rawPartialPerformance * 0.10, 2);

  // 5. Pending / Overdue Delivery (10% internal weight)
  const pendingQuantity = Math.max(0, totalOrderedQuantity - totalReceivedQuantity);
  let rawOverdueScore = 100;
  if (totalOrderedQuantity > 0 && pendingQuantity > 0) {
    const overdueRatio = pendingQuantity / totalOrderedQuantity;
    rawOverdueScore = clamp(round(100 - (overdueRatio * 100), 2));
  }
  const overduePoints = round(rawOverdueScore * 0.10, 2);

  // 6. Delivery Consistency (5% internal weight)
  let rawConsistency = 100;
  if (delayList.length >= 2) {
    const mean = delayList.reduce((a, b) => a + b, 0) / delayList.length;
    const variance =
      delayList.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) /
      delayList.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev <= 1.0) rawConsistency = 100;
    else if (stdDev <= 5.0) rawConsistency = 80;
    else if (stdDev <= 15.0) rawConsistency = 60;
    else rawConsistency = 40;
  }
  const consistencyPoints = round(rawConsistency * 0.05, 2);

  // Composite 100-point delivery score
  let finalDeliveryScore = null;
  if (purchaseOrders.length === 0 && normalReceipts.length === 0) {
    finalDeliveryScore = null;
  } else if (totalReceivedQuantity === 0 && totalOrderedQuantity > 0) {
    finalDeliveryScore = 0;
  } else {
    finalDeliveryScore = clamp(
      round(
        timelinessPoints +
        dispatchAdherencePoints +
        completenessPoints +
        partialPerformancePoints +
        overduePoints +
        consistencyPoints,
        2
      )
    );
  }

  const dimensions = {
    timeliness: {
      weight: 45,
      score: rawTimeliness,
      weightedPoints: timelinessPoints,
    },
    dispatchAdherence: {
      weight: 15,
      score: rawDispatchAdherence,
      weightedPoints: dispatchAdherencePoints,
    },
    completeness: {
      weight: 15,
      score: rawCompleteness,
      weightedPoints: completenessPoints,
    },
    partialPerformance: {
      weight: 10,
      score: rawPartialPerformance,
      weightedPoints: partialPerformancePoints,
    },
    overduePending: {
      weight: 10,
      score: rawOverdueScore,
      weightedPoints: overduePoints,
    },
    consistency: {
      weight: 5,
      score: rawConsistency,
      weightedPoints: consistencyPoints,
    },
  };

  return {
    systemScore: finalDeliveryScore,
    evaluatorScore: null,
    finalScore: finalDeliveryScore,
    weight: WEIGHTS.delivery,
    adjustment: 0,
    adjustmentReason: "",
    totalOrdersEvaluated: purchaseOrders.length,
    totalDispatchesEvaluated: normalDispatches.length,
    orderedQuantity: round(totalOrderedQuantity),
    dispatchedQuantity: round(totalDispatchedQuantity),
    receivedQuantity: round(totalReceivedQuantity),
    onTimeQuantity: round(onTimeQuantity),
    delayedQuantity: round(delayedQuantity),
    totalDelayDays: round(totalDelayDays),
    averageDelayDays,
    partialDispatchCount,
    multipleDispatchPOCount,
    dimensions,
    remarks:
      finalDeliveryScore === null
        ? "No completed receipts available for delivery evaluation in this period."
        : "",
  };
};

// =========================================================
// 2. QUALITY SCORE (25%)
// =========================================================
/**
 * Evaluates original quality inspection results.
 * Excludes re-inspections (which represent rework/replacement evaluations)
 * so original baseline defect rates are preserved accurately.
 *
 * Categorization:
 *  - Approved deviation / Conditional acceptance = deviationAcceptedQuantity (concession, not defect)
 *  - Rejected deviation = deviationRejectedQuantity (defect)
 *  - Accepted damage = damagedAcceptedQuantity (concession)
 *  - Rejected damage = damagedRejectedQuantity (defect)
 *  - Normal rejected = normalRejectedQuantity (defect)
 */
const calculateQuality = ({
  qualityInspections,
  reInspections,
  replacementRequests = [],
}) => {
  let inspectedQuantity = 0;
  let normalAcceptedQuantity = 0;
  let deviationQuantity = 0;
  let deviationAcceptedQuantity = 0;
  let deviationRejectedQuantity = 0;
  let damagedQuantity = 0;
  let damagedAcceptedQuantity = 0;
  let damagedRejectedQuantity = 0;
  let normalRejectedQuantity = 0;
  let deviationCount = 0;

  // Filter ONLY original inspections
  const originalInspections = qualityInspections.filter(
    (i) =>
      !i.isDeleted &&
      i.status !== "Cancelled" &&
      !i.isReinspection &&
      !i.originalInspection
  );

  for (const inspection of originalInspections) {
    if (inspection.deviationRequired === true) {
      deviationCount += 1;
    }

    for (const item of inspection.items || []) {
      const inspected = toNumber(item.inspectionQuantity);
      const accepted = toNumber(item.acceptedQuantity);
      const rejected = toNumber(item.rejectedQuantity);
      const damaged = toNumber(item.damagedQuantity);

      inspectedQuantity += inspected;
      damagedQuantity += damaged;

      // Deviation / Conditional Acceptance
      if (
        inspection.deviationRequired === true ||
        item.result === "Conditional Acceptance"
      ) {
        deviationQuantity += accepted + rejected;

        if (
          inspection.deviationApproved === true ||
          item.result === "Conditional Acceptance"
        ) {
          deviationAcceptedQuantity += accepted;
          deviationRejectedQuantity += rejected;
        } else {
          normalAcceptedQuantity += accepted;
          deviationRejectedQuantity += rejected;
        }
      } else {
        normalAcceptedQuantity += accepted;
        normalRejectedQuantity += rejected;
      }

      // Damage Separation
      if (damaged > 0) {
        if (item.result === "Accepted with Damage") {
          damagedAcceptedQuantity += damaged;
        } else {
          damagedRejectedQuantity += damaged;
        }
      }
    }
  }

  const totalRejectedQuantity = normalRejectedQuantity + deviationRejectedQuantity;
  const totalDamagedQuantity = damagedQuantity;

  let reInspectionCount = 0;
  for (const reInspection of reInspections || []) {
    if (reInspection.status === "Completed") {
      reInspectionCount += 1;
    }
  }

  const rejectionPercentage = percentage(totalRejectedQuantity, inspectedQuantity);
  const damagePercentage = percentage(damagedRejectedQuantity, inspectedQuantity);
  const defectPercentage = percentage(
    totalRejectedQuantity + damagedRejectedQuantity,
    inspectedQuantity
  );

  let qualityScore = null;
  if (inspectedQuantity > 0) {
    qualityScore = clamp(round(100 - defectPercentage));
  }

  const replacementQualityCases = (replacementRequests || []).filter(
    (r) => !r.isDeleted && r.status !== "Cancelled"
  ).length;

  return {
    systemScore: qualityScore,
    evaluatorScore: null,
    finalScore: qualityScore,
    weight: WEIGHTS.quality,
    adjustment: 0,
    adjustmentReason: "",
    inspectedQuantity: round(inspectedQuantity),
    normalAcceptedQuantity: round(normalAcceptedQuantity),
    deviationQuantity: round(deviationQuantity),
    deviationAcceptedQuantity: round(deviationAcceptedQuantity),
    deviationRejectedQuantity: round(deviationRejectedQuantity),
    damagedQuantity: round(totalDamagedQuantity),
    damagedAcceptedQuantity: round(damagedAcceptedQuantity),
    damagedRejectedQuantity: round(damagedRejectedQuantity),
    normalRejectedQuantity: round(normalRejectedQuantity),
    totalRejectedQuantity: round(totalRejectedQuantity),
    totalDamagedQuantity: round(totalDamagedQuantity),
    defectPercentage,
    rejectionPercentage,
    damagePercentage,
    deviationCount,
    reInspectionCount,
    replacementQualityCases,
    remarks:
      qualityScore === null
        ? "No completed inspections available for quality evaluation in this period."
        : "",
  };
};

// =========================================================
// 3. FULFILLMENT SCORE (15%)
// =========================================================
/**
 * Tracks order fulfillment:
 *  - Original accepted from first inspections
 *  - Recovered accepted from ORIGINAL_MATERIAL re-inspections
 *  - Replacement accepted from replacement deliveries
 *
 * Avoids double-counting replacement quantities.
 */
const calculateFulfillment = ({
  purchaseOrders,
  dispatches,
  goodsReceipts,
  qualityInspections,
  replacementRequests,
  reInspections = [],
}) => {
  let orderedQuantity = 0;
  let dispatchedQuantity = 0;
  let receivedQuantity = 0;
  let originalAcceptedQuantity = 0;
  let replacementRequestedQuantity = 0;
  let replacementApprovedQuantity = 0;
  let replacementDispatchedQuantity = 0;
  let replacementReceivedQuantity = 0;
  let replacementAcceptedQuantity = 0;
  let originalRecoveredQuantity = 0;

  for (const po of purchaseOrders) {
    for (const item of po.items || []) {
      orderedQuantity += toNumber(item.quantity);
    }
  }

  for (const dispatch of dispatches) {
    if (dispatch.isDeleted) continue;
    for (const item of dispatch.items || []) {
      const qty = toNumber(item.dispatchQuantity);
      if (
        dispatch.dispatchType === "Replacement" ||
        item.isReplacement === true
      ) {
        replacementDispatchedQuantity += qty;
      } else {
        dispatchedQuantity += qty;
      }
    }
  }

  for (const receipt of goodsReceipts) {
    if (receipt.isDeleted || receipt.status === "Cancelled") continue;
    for (const item of receipt.items || []) {
      const qty = toNumber(item.receivedQuantity);
      if (receipt.receiptType === "Replacement") {
        replacementReceivedQuantity += qty;
      } else {
        receivedQuantity += qty;
      }
    }
  }

  // Original accepted from non-reinspection QualityInspections
  const originalInspections = qualityInspections.filter(
    (i) =>
      !i.isDeleted &&
      i.status !== "Cancelled" &&
      !i.isReinspection &&
      !i.originalInspection
  );

  for (const inspection of originalInspections) {
    for (const item of inspection.items || []) {
      originalAcceptedQuantity += toNumber(item.acceptedQuantity);
    }
  }

  // Replacement Requests
  for (const request of replacementRequests) {
    if (request.isDeleted || request.status === "Cancelled") continue;
    for (const item of request.items || []) {
      replacementRequestedQuantity += toNumber(item.replacementQuantity);
      replacementApprovedQuantity += toNumber(item.replacementApprovedQuantity);
      replacementAcceptedQuantity += toNumber(item.replacementAcceptedQuantity);
    }
  }

  // Completed Re-Inspections
  for (const reInspection of reInspections) {
    if (reInspection.status !== "Completed") continue;
    if (reInspection.reinspectionType === "ORIGINAL_MATERIAL") {
      for (const item of reInspection.items || []) {
        originalRecoveredQuantity += toNumber(item.acceptedQuantity);
      }
    }
  }

  const netFulfilled =
    originalAcceptedQuantity +
    originalRecoveredQuantity +
    replacementAcceptedQuantity;

  const finalFulfilledQuantity = Math.min(orderedQuantity, netFulfilled);
  const pendingQuantity = Math.max(0, orderedQuantity - finalFulfilledQuantity);
  const originalPendingQuantity = Math.max(
    0,
    orderedQuantity - (originalAcceptedQuantity + originalRecoveredQuantity)
  );
  const replacementPendingQuantity = Math.max(
    0,
    replacementRequestedQuantity - replacementAcceptedQuantity
  );

  let fulfillmentPercentage = null;
  if (orderedQuantity > 0) {
    fulfillmentPercentage = percentage(finalFulfilledQuantity, orderedQuantity);
  }

  return {
    systemScore: fulfillmentPercentage,
    evaluatorScore: null,
    finalScore: fulfillmentPercentage,
    weight: WEIGHTS.fulfillment,
    adjustment: 0,
    adjustmentReason: "",
    orderedQuantity: round(orderedQuantity),
    dispatchedQuantity: round(dispatchedQuantity),
    receivedQuantity: round(receivedQuantity),
    originalAcceptedQuantity: round(originalAcceptedQuantity),
    reInspectionAcceptedQuantity: round(originalRecoveredQuantity),
    replacementRequestedQuantity: round(replacementRequestedQuantity),
    replacementApprovedQuantity: round(replacementApprovedQuantity),
    replacementDispatchedQuantity: round(replacementDispatchedQuantity),
    replacementReceivedQuantity: round(replacementReceivedQuantity),
    replacementAcceptedQuantity: round(replacementAcceptedQuantity),
    finalFulfilledQuantity: round(finalFulfilledQuantity),
    pendingQuantity: round(pendingQuantity),
    originalPendingQuantity: round(originalPendingQuantity),
    replacementPendingQuantity: round(replacementPendingQuantity),
    fulfillmentPercentage: fulfillmentPercentage ?? 0,
    remarks:
      fulfillmentPercentage === null
        ? "No purchase order quantities to fulfill in this period."
        : "",
  };
};

// =========================================================
// 4. PRICE COMPETITIVENESS (10%)
// =========================================================
/**
 * Compares PO item prices against Material.standardCost.
 * Resolves N+1 database queries via single batch lookup.
 * Uses reference-priced quantity as denominator for accurate price averages.
 */
const calculatePrice = async ({ purchaseOrders }) => {
  // Collect unique material IDs
  const materialIdSet = new Set();
  for (const po of purchaseOrders) {
    for (const item of po.items || []) {
      if (item.material) {
        materialIdSet.add(String(item.material._id || item.material));
      }
    }
  }

  // Batch query materials
  const materials = await Material.find({
    _id: { $in: Array.from(materialIdSet) },
  })
    .select("standardCost")
    .lean();

  const standardCostMap = new Map();
  for (const mat of materials) {
    if (mat.standardCost !== undefined && mat.standardCost !== null && mat.standardCost > 0) {
      standardCostMap.set(String(mat._id), toNumber(mat.standardCost));
    }
  }

  let purchaseOrderCount = 0;
  let referencePriceCount = 0;
  let referencePricedQuantity = 0;
  let totalVendorValue = 0;
  let totalReferenceValue = 0;
  let weightedVariance = 0;

  for (const po of purchaseOrders) {
    purchaseOrderCount += 1;

    for (const item of po.items || []) {
      const matId = String(item.material?._id || item.material);
      const referencePrice = standardCostMap.get(matId);
      const quantity = toNumber(item.quantity);
      const vendorPrice = toNumber(item.unitPrice);

      if (!referencePrice || referencePrice <= 0 || quantity <= 0) {
        continue;
      }

      referencePriceCount += 1;
      referencePricedQuantity += quantity;

      const vendorValue = vendorPrice * quantity;
      const refValue = referencePrice * quantity;

      totalVendorValue += vendorValue;
      totalReferenceValue += refValue;

      const variance = ((vendorPrice - referencePrice) / referencePrice) * 100;
      weightedVariance += Math.max(0, variance) * quantity;
    }
  }

  const averageVendorPrice =
    referencePricedQuantity > 0 ? totalVendorValue / referencePricedQuantity : 0;
  const averageReferencePrice =
    referencePricedQuantity > 0 ? totalReferenceValue / referencePricedQuantity : 0;
  const averageVariancePercentage =
    referencePricedQuantity > 0 ? weightedVariance / referencePricedQuantity : 0;

  let score = null;
  if (referencePriceCount > 0 && referencePricedQuantity > 0) {
    if (averageVariancePercentage <= 0) score = 100;
    else if (averageVariancePercentage <= 5) score = 95;
    else if (averageVariancePercentage <= 10) score = 90;
    else if (averageVariancePercentage <= 15) score = 75;
    else if (averageVariancePercentage <= 20) score = 60;
    else score = 40;
  }

  return {
    systemScore: score,
    evaluatorScore: null,
    finalScore: score,
    weight: WEIGHTS.price,
    adjustment: 0,
    adjustmentReason: "",
    purchaseOrderCount,
    referencePriceCount,
    averageVendorPrice: round(averageVendorPrice),
    averageReferencePrice: round(averageReferencePrice),
    averageVariancePercentage: round(averageVariancePercentage),
    remarks:
      referencePriceCount === 0
        ? "No standard material cost available for price comparison."
        : "",
  };
};

// =========================================================
// 5. RESPONSE TIME (5%)
// =========================================================
const calculateResponseTime = ({ purchaseOrders }) => {
  const responseTimes = [];
  let noResponseCount = 0;

  for (const po of purchaseOrders) {
    if (!po.sentDate) continue;
    if (!po.vendorResponseDate) {
      noResponseCount += 1;
      continue;
    }

    const rawDiffMinutes = differenceInMinutes(po.sentDate, po.vendorResponseDate);
    responseTimes.push(Math.max(0, rawDiffMinutes));
  }

  const responseCount = responseTimes.length;
  const totalResponses = responseCount + noResponseCount;

  const averageResponseMinutes =
    responseCount > 0
      ? responseTimes.reduce((sum, v) => sum + v, 0) / responseCount
      : 0;

  const fastestResponseMinutes =
    responseCount > 0 ? Math.min(...responseTimes) : 0;
  const slowestResponseMinutes =
    responseCount > 0 ? Math.max(...responseTimes) : 0;

  let score = null;
  if (totalResponses > 0) {
    let weightedScore = 0;
    for (const minutes of responseTimes) {
      let responseScore = 100;
      if (minutes < 60) responseScore = 100;
      else if (minutes <= 360) responseScore = 95;
      else if (minutes <= 1440) responseScore = 80;
      else if (minutes <= 2880) responseScore = 60;
      else responseScore = 40;

      weightedScore += responseScore;
    }
    weightedScore += noResponseCount * 30;
    score = clamp(round(weightedScore / totalResponses));
  }

  return {
    systemScore: score,
    evaluatorScore: null,
    finalScore: score,
    weight: WEIGHTS.responseTime,
    adjustment: 0,
    adjustmentReason: "",
    responseCount,
    averageResponseMinutes: round(averageResponseMinutes),
    fastestResponseMinutes: round(fastestResponseMinutes),
    slowestResponseMinutes: round(slowestResponseMinutes),
    noResponseCount,
    remarks:
      score === null ? "No PO response tracking data in this period." : "",
  };
};

// =========================================================
// 6. PO ACCEPTANCE (5%)
// =========================================================
const calculatePOAcceptance = ({ purchaseOrders }) => {
  const evaluatedPOs = purchaseOrders.filter(
    (po) => po.vendorAccepted !== null && po.vendorAccepted !== undefined
  );

  const totalPOs = evaluatedPOs.length;
  const acceptedPOs = evaluatedPOs.filter((po) => po.vendorAccepted === true).length;
  const rejectedPOs = evaluatedPOs.filter((po) => po.vendorAccepted === false).length;
  const acceptancePercentage = totalPOs > 0 ? percentage(acceptedPOs, totalPOs) : null;

  return {
    systemScore: acceptancePercentage,
    evaluatorScore: null,
    finalScore: acceptancePercentage,
    weight: WEIGHTS.poAcceptance,
    adjustment: 0,
    adjustmentReason: "",
    totalPOs,
    acceptedPOs,
    rejectedPOs,
    acceptancePercentage: acceptancePercentage ?? 0,
    remarks: totalPOs === 0 ? "No POs with acceptance status in this period." : "",
  };
};

// =========================================================
// 7. DOCUMENTATION COMPLIANCE (5%)
// =========================================================
const calculateDocumentation = ({
  dispatches,
  goodsReceipts,
  qualityInspections,
}) => {
  let requiredDocuments = 0;
  let submittedDocuments = 0;
  let validDocuments = 0;
  let missingDocuments = 0;

  // Normal Dispatches
  for (const dispatch of dispatches) {
    if (dispatch.isDeleted || dispatch.dispatchType === "Replacement") continue;
    requiredDocuments += 1;
    const docs = Array.isArray(dispatch.documents) ? dispatch.documents : [];
    if (docs.length > 0) {
      submittedDocuments += 1;
      validDocuments += 1;
    } else {
      missingDocuments += 1;
    }
  }

  // Normal GRNs
  for (const receipt of goodsReceipts) {
    if (receipt.isDeleted || receipt.receiptType === "Replacement" || receipt.status === "Cancelled") {
      continue;
    }
    requiredDocuments += 1;
    const docs = Array.isArray(receipt.documents) ? receipt.documents : [];
    if (docs.length > 0) {
      submittedDocuments += 1;
      validDocuments += 1;
    } else {
      missingDocuments += 1;
    }
  }

  // Quality Inspections
  for (const inspection of qualityInspections) {
    if (inspection.isDeleted || inspection.status === "Cancelled" || inspection.documentationStatus === "Not Required") {
      continue;
    }
    requiredDocuments += 1;
    if (inspection.documentationStatus === "Verified") {
      submittedDocuments += 1;
      validDocuments += 1;
    } else {
      missingDocuments += 1;
    }
  }

  let compliancePercentage = null;
  if (requiredDocuments > 0) {
    compliancePercentage = percentage(validDocuments, requiredDocuments);
  }

  return {
    systemScore: compliancePercentage,
    evaluatorScore: null,
    finalScore: compliancePercentage,
    weight: WEIGHTS.documentation,
    adjustment: 0,
    adjustmentReason: "",
    requiredDocuments,
    submittedDocuments,
    validDocuments,
    missingDocuments,
    documentationCompliancePercentage: compliancePercentage ?? 100,
    remarks:
      compliancePercentage === null
        ? "No document requirements evaluated in this period."
        : "",
  };
};

// =========================================================
// 8. COMMUNICATION (5%) - Evaluator Controlled
// =========================================================
const createCommunicationEvidence = () => ({
  systemScore: null,
  evaluatorScore: null,
  finalScore: null,
  weight: WEIGHTS.communication,
  adjustment: 0,
  adjustmentReason: "",
  evaluatorRating: null,
  evaluatorRemarks: "",
  evaluatedBy: null,
  evaluatedAt: null,
});

// =========================================================
// COMPLAINT - Conditional / Informational
// =========================================================
const createComplaintEvidence = () => ({
  applicable: false,
  complaintCount: 0,
  resolvedComplaintCount: 0,
  openComplaintCount: 0,
  averageResolutionDays: 0,
  score: null,
  remarks: "No formal complaints recorded in this period.",
});

// =========================================================
// REPLACEMENT & RE-INSPECTION SUMMARIES
// =========================================================
const calculateReplacementSummary = ({ replacementRequests }) => {
  let requestCount = 0;
  let requestedQuantity = 0;
  let approvedQuantity = 0;
  let dispatchedQuantity = 0;
  let receivedQuantity = 0;
  let inspectedQuantity = 0;
  let acceptedQuantity = 0;
  let rejectedQuantity = 0;
  let damagedQuantity = 0;
  let pendingQuantity = 0;
  const responseHours = [];
  const deliveryDelayDays = [];

  for (const request of replacementRequests) {
    if (request.isDeleted || request.status === "Cancelled") continue;
    requestCount += 1;

    if (request.requestedDate && request.vendorResponseDate) {
      const minutes = differenceInMinutes(
        request.requestedDate,
        request.vendorResponseDate
      );
      responseHours.push(Math.max(0, minutes) / 60);
    }

    if (request.requiredReplacementDate && request.actualReplacementDate) {
      const delay = differenceInDays(
        request.requiredReplacementDate,
        request.actualReplacementDate
      );
      deliveryDelayDays.push(Math.max(0, delay));
    }

    for (const item of request.items || []) {
      requestedQuantity += toNumber(item.replacementQuantity);
      approvedQuantity += toNumber(item.replacementApprovedQuantity);
      dispatchedQuantity += toNumber(item.replacementDispatchedQuantity);
      receivedQuantity += toNumber(item.replacementReceivedQuantity);
      inspectedQuantity += toNumber(item.replacementInspectedQuantity);
      acceptedQuantity += toNumber(item.replacementAcceptedQuantity);
      rejectedQuantity += toNumber(item.replacementRejectedQuantity);
      damagedQuantity += toNumber(item.replacementDamagedQuantity);
      pendingQuantity += toNumber(item.replacementPendingQuantity);
    }
  }

  const averageResponseHours =
    responseHours.length > 0
      ? responseHours.reduce((sum, v) => sum + v, 0) / responseHours.length
      : 0;

  const averageDeliveryDelayDays =
    deliveryDelayDays.length > 0
      ? deliveryDelayDays.reduce((sum, v) => sum + v, 0) / deliveryDelayDays.length
      : 0;

  return {
    requestCount,
    requestedQuantity: round(requestedQuantity),
    approvedQuantity: round(approvedQuantity),
    dispatchedQuantity: round(dispatchedQuantity),
    receivedQuantity: round(receivedQuantity),
    inspectedQuantity: round(inspectedQuantity),
    acceptedQuantity: round(acceptedQuantity),
    rejectedQuantity: round(rejectedQuantity),
    damagedQuantity: round(damagedQuantity),
    pendingQuantity: round(pendingQuantity),
    averageResponseHours: round(averageResponseHours),
    averageDeliveryDelayDays: round(averageDeliveryDelayDays),
  };
};

const calculateReInspectionSummary = ({ reInspections }) => {
  let totalReInspections = 0;
  let inspectedQuantity = 0;
  let acceptedQuantity = 0;
  let rejectedQuantity = 0;
  let damagedQuantity = 0;
  let deviationAcceptedQuantity = 0;
  let deviationRejectedQuantity = 0;

  for (const reInspection of reInspections || []) {
    if (reInspection.status === "Cancelled") continue;
    totalReInspections += 1;

    for (const item of reInspection.items || []) {
      inspectedQuantity += toNumber(item.inspectionQuantity);
      acceptedQuantity += toNumber(item.acceptedQuantity);
      rejectedQuantity += toNumber(item.rejectedQuantity);
      damagedQuantity += toNumber(item.damagedQuantity);
    }
  }

  return {
    totalReInspections,
    inspectedQuantity: round(inspectedQuantity),
    acceptedQuantity: round(acceptedQuantity),
    rejectedQuantity: round(rejectedQuantity),
    damagedQuantity: round(damagedQuantity),
    deviationAcceptedQuantity: round(deviationAcceptedQuantity),
    deviationRejectedQuantity: round(deviationRejectedQuantity),
  };
};

const createTransactionSummary = ({ purchaseOrders, fulfillment, quality }) => {
  const completedPurchaseOrders = purchaseOrders.filter((po) =>
    ["Delivered", "Closed"].includes(po.status)
  ).length;

  return {
    totalPurchaseOrders: purchaseOrders.length,
    completedPurchaseOrders,
    totalOrderedQuantity: fulfillment.orderedQuantity,
    totalDispatchedQuantity: fulfillment.dispatchedQuantity,
    totalReceivedQuantity: fulfillment.receivedQuantity,
    totalAcceptedQuantity:
      quality.normalAcceptedQuantity +
      quality.deviationAcceptedQuantity +
      quality.damagedAcceptedQuantity,
    totalRejectedQuantity: quality.totalRejectedQuantity,
    totalDamagedQuantity: quality.totalDamagedQuantity,
    totalPendingQuantity: fulfillment.pendingQuantity,
  };
};

// =========================================================
// OVERALL SCORE CALCULATIONS
// =========================================================
const calculateWeightedSystemScore = (parameters) => {
  let weightedTotal = 0;
  let availableWeight = 0;

  for (const param of parameters) {
    if (param.systemScore === null || param.systemScore === undefined) {
      continue;
    }
    weightedTotal += toNumber(param.systemScore) * toNumber(param.weight);
    availableWeight += toNumber(param.weight);
  }

  if (availableWeight === 0) return null;
  return clamp(round(weightedTotal / availableWeight));
};

const calculateWeightedFinalScore = (parameters) => {
  let weightedTotal = 0;
  let availableWeight = 0;

  for (const param of parameters) {
    const score = param.finalScore;
    if (score === null || score === undefined) {
      continue;
    }
    weightedTotal += toNumber(score) * toNumber(param.weight);
    availableWeight += toNumber(param.weight);
  }

  if (availableWeight === 0) return null;
  return clamp(round(weightedTotal / availableWeight));
};

// =========================================================
// FETCH VENDOR TRANSACTIONS (EVENT DATES + NO isDeleted on ReInspection)
// =========================================================
const getVendorTransactions = async ({ vendorId, fromDate, toDate }) => {
  const start = startOfDay(fromDate);
  const end = endOfDay(toDate);

  const buildDateQuery = (dateField) => {
    if (!start && !end) return {};
    const range = {};
    if (start) range.$gte = start;
    if (end) range.$lte = end;
    return {
      $or: [
        { [dateField]: range },
        { [dateField]: null, createdAt: range },
      ],
    };
  };

  const baseFilter = { vendor: vendorId, isDeleted: false };

  // 1. Fetch Purchase Orders and Dispatches in period
  const [purchaseOrders, dispatches] = await Promise.all([
    PurchaseOrder.find({
      ...baseFilter,
      ...buildDateQuery("orderDate"),
    }).lean(),

    Dispatch.find({
      ...baseFilter,
      ...buildDateQuery("dispatchDate"),
    }).lean(),
  ]);

  const dispatchIds = dispatches.map((d) => d._id);
  const poIds = purchaseOrders.map((p) => p._id);

  // 2. Fetch Goods Receipts, QIs, ReInspections, Replacement Requests
  // Ensure Goods Receipts matching evaluated Dispatches or POs are included even if receiptDate crosses the boundary
  const [
    goodsReceipts,
    qualityInspections,
    reInspections,
    replacementRequests,
  ] = await Promise.all([
    GoodsReceipt.find({
      ...baseFilter,
      $or: [
        ...(buildDateQuery("receiptDate").$or || []),
        { dispatch: { $in: dispatchIds } },
        { purchaseOrder: { $in: poIds } },
      ],
    }).lean(),

    QualityInspection.find({
      ...baseFilter,
      $or: [
        ...(buildDateQuery("inspectionDate").$or || []),
        { purchaseOrder: { $in: poIds } },
        { dispatch: { $in: dispatchIds } },
      ],
    }).lean(),

    // Note: ReInspection has NO isDeleted field
    ReInspection.find({
      vendor: vendorId,
      ...buildDateQuery("createdAt"),
    }).lean(),

    ReplacementRequest.find({
      ...baseFilter,
      $or: [
        ...(buildDateQuery("requestedDate").$or || []),
        { purchaseOrder: { $in: poIds } },
      ],
    }).lean(),
  ]);

  return {
    purchaseOrders,
    dispatches,
    goodsReceipts,
    qualityInspections,
    reInspections,
    replacementRequests,
  };
};

// =========================================================
// GENERATE VENDOR RATING
// =========================================================
export const generateVendorRating = async ({
  vendorId,
  fromDate,
  toDate,
  createdBy,
}) => {
  if (!vendorId) throw new Error("Vendor ID is required.");
  if (!fromDate || !toDate) throw new Error("Evaluation period is required.");

  const start = startOfDay(fromDate);
  const end = endOfDay(toDate);

  if (start > end) {
    throw new Error("From date cannot be after to date.");
  }

  const vendor = await Vendor.findOne({ _id: vendorId, isDeleted: false }).lean();
  if (!vendor) throw new Error("Vendor not found.");

  // Check existing rating for duplicate prevention
  const existingRating = await VendorRating.findOne({
    vendor: vendorId,
    "evaluationPeriod.fromDate": start,
    "evaluationPeriod.toDate": end,
    isDeleted: false,
  });

  if (existingRating) {
    if (["Submitted", "Approved", "Locked"].includes(existingRating.status)) {
      throw new Error(
        `An evaluation for this period already exists with status: "${existingRating.status}". Modification is restricted.`
      );
    }
  }

  const transactions = await getVendorTransactions({
    vendorId,
    fromDate,
    toDate,
  });

  const delivery = calculateDelivery({
    purchaseOrders: transactions.purchaseOrders,
    dispatches: transactions.dispatches,
    goodsReceipts: transactions.goodsReceipts,
  });

  const quality = calculateQuality({
    qualityInspections: transactions.qualityInspections,
    reInspections: transactions.reInspections,
    replacementRequests: transactions.replacementRequests,
  });

  const fulfillment = calculateFulfillment({
    purchaseOrders: transactions.purchaseOrders,
    dispatches: transactions.dispatches,
    goodsReceipts: transactions.goodsReceipts,
    qualityInspections: transactions.qualityInspections,
    replacementRequests: transactions.replacementRequests,
    reInspections: transactions.reInspections,
  });

  const price = await calculatePrice({
    purchaseOrders: transactions.purchaseOrders,
  });

  const responseTime = calculateResponseTime({
    purchaseOrders: transactions.purchaseOrders,
  });

  const poAcceptance = calculatePOAcceptance({
    purchaseOrders: transactions.purchaseOrders,
  });

  const documentation = calculateDocumentation({
    dispatches: transactions.dispatches,
    goodsReceipts: transactions.goodsReceipts,
    qualityInspections: transactions.qualityInspections,
  });

  const communication = createCommunicationEvidence();
  const complaint = createComplaintEvidence();

  const replacementSummary = calculateReplacementSummary({
    replacementRequests: transactions.replacementRequests,
  });

  const reInspectionSummary = calculateReInspectionSummary({
    reInspections: transactions.reInspections,
  });

  const transactionSummary = createTransactionSummary({
    purchaseOrders: transactions.purchaseOrders,
    fulfillment,
    quality,
  });

  const parameterList = [
    delivery,
    quality,
    fulfillment,
    price,
    responseTime,
    poAcceptance,
    documentation,
    communication,
  ];

  const systemOverallScore = calculateWeightedSystemScore(parameterList);
  const finalOverallScore = calculateWeightedFinalScore(parameterList);

  const ratingData = {
    vendor: vendorId,
    evaluationPeriod: { fromDate: start, toDate: end },
    delivery,
    quality,
    fulfillment,
    price,
    responseTime,
    poAcceptance,
    documentation,
    communication,
    complaint,
    replacementSummary,
    reInspectionSummary,
    transactionSummary,
    systemOverallScore,
    evaluatorOverallScore: null,
    finalOverallScore,
    ratingCategory: getRatingCategory(finalOverallScore),
    status: "Draft",
    evaluatedBy: null,
    evaluatedAt: null,
    approvedBy: null,
    approvedAt: null,
    lockedBy: null,
    lockedAt: null,
    remarks: "",
    updatedBy: createdBy,
  };

  if (existingRating && existingRating.status === "Draft") {
    Object.assign(existingRating, ratingData);
    await existingRating.save();
    return existingRating;
  }

  return VendorRating.create({
    ...ratingData,
    createdBy,
  });
};

// =========================================================
// GET VENDOR RATINGS (PAGINATED)
// =========================================================
export const getVendorRatings = async ({
  vendorId,
  page = 1,
  limit = 10,
  status = "",
} = {}) => {
  const currentPage = Math.max(1, Number(page) || 1);
  const currentLimit = Math.max(1, Number(limit) || 10);
  const filter = { isDeleted: false };

  if (vendorId) filter.vendor = vendorId;
  if (status) filter.status = status;

  const skip = (currentPage - 1) * currentLimit;

  const [ratings, total] = await Promise.all([
    VendorRating.find(filter)
      .populate("vendor", "vendorCode vendorName vendorCategory status")
      .populate("evaluatedBy", "name email role")
      .populate("approvedBy", "name email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(currentLimit)
      .lean(),
    VendorRating.countDocuments(filter),
  ]);

  return {
    ratings,
    total,
    page: currentPage,
    limit: currentLimit,
    totalPages: Math.ceil(total / currentLimit),
  };
};

// =========================================================
// GET RATING BY ID
// =========================================================
export const getVendorRatingById = async (ratingId) => {
  if (!ratingId) throw new Error("Vendor Rating ID is required.");

  const rating = await VendorRating.findOne({
    _id: ratingId,
    isDeleted: false,
  })
    .populate("vendor", "vendorCode vendorName vendorCategory status")
    .populate("evaluatedBy", "name email role")
    .populate("approvedBy", "name email role")
    .populate("lockedBy", "name email role");

  if (!rating) throw new Error("Vendor rating not found.");
  return rating;
};

// =========================================================
// UPDATE EVALUATOR SCORES
// =========================================================
export const updateEvaluatorScores = async ({
  ratingId,
  evaluatorScores = {},
  communication = {},
  remarks = "",
  evaluatedBy,
}) => {
  const rating = await VendorRating.findOne({
    _id: ratingId,
    isDeleted: false,
  });

  if (!rating) throw new Error("Vendor rating not found.");
  if (["Approved", "Locked"].includes(rating.status)) {
    throw new Error("Approved or locked ratings cannot be modified.");
  }

  const parameters = [
    "delivery",
    "quality",
    "fulfillment",
    "price",
    "responseTime",
    "poAcceptance",
    "documentation",
  ];

  for (const param of parameters) {
    if (evaluatorScores[param] === undefined || evaluatorScores[param] === null) {
      continue;
    }

    const val = Number(evaluatorScores[param]);
    if (!Number.isFinite(val) || val < 0 || val > 100) {
      throw new Error(`${param} evaluator score must be between 0 and 100.`);
    }

    const systemScore = rating[param].systemScore;
    const reason = String(
      evaluatorScores[`${param}AdjustmentReason`] || ""
    ).trim();

    if (
      systemScore !== null &&
      systemScore !== undefined &&
      val !== Number(systemScore) &&
      !reason
    ) {
      throw new Error(
        `${param} adjustment reason is required when evaluator score differs from system score.`
      );
    }

    rating[param].evaluatorScore = val;
    rating[param].finalScore = val;
    rating[param].adjustment =
      systemScore === null || systemScore === undefined
        ? 0
        : round(val - Number(systemScore));
    rating[param].adjustmentReason = reason;
  }

  // Communication score handling
  if (communication.score !== undefined && communication.score !== null) {
    const commScore = Number(communication.score);
    if (!Number.isFinite(commScore) || commScore < 0 || commScore > 100) {
      throw new Error("Communication score must be between 0 and 100.");
    }

    rating.communication.evaluatorScore = commScore;
    rating.communication.finalScore = commScore;
    rating.communication.adjustment = 0;
    rating.communication.adjustmentReason = "";
    rating.communication.evaluatorRating = communication.rating || null;
    rating.communication.evaluatorRemarks = String(communication.remarks || "").trim();
    rating.communication.evaluatedBy = evaluatedBy;
    rating.communication.evaluatedAt = new Date();
  }

  rating.evaluatedBy = evaluatedBy;
  rating.evaluatedAt = new Date();
  if (remarks) rating.remarks = remarks;

  const parameterList = [
    rating.delivery,
    rating.quality,
    rating.fulfillment,
    rating.price,
    rating.responseTime,
    rating.poAcceptance,
    rating.documentation,
    rating.communication,
  ];

  rating.evaluatorOverallScore = calculateWeightedFinalScore(parameterList);
  rating.finalOverallScore = calculateWeightedFinalScore(parameterList);
  rating.ratingCategory = getRatingCategory(rating.finalOverallScore);
  rating.status = "Under Review";
  rating.updatedBy = evaluatedBy;

  await rating.save();
  return rating;
};

// =========================================================
// SUBMIT VENDOR RATING
// =========================================================
export const submitVendorRating = async ({ ratingId, userId }) => {
  const rating = await VendorRating.findOne({
    _id: ratingId,
    isDeleted: false,
  });

  if (!rating) throw new Error("Vendor rating not found.");
  if (["Approved", "Locked"].includes(rating.status)) {
    throw new Error("Approved or locked ratings cannot be submitted again.");
  }

  if (rating.communication.evaluatorScore === null) {
    throw new Error(
      "Communication score must be entered by evaluator before submitting the rating."
    );
  }

  rating.status = "Submitted";
  rating.evaluatedBy = userId;
  rating.evaluatedAt = new Date();
  rating.updatedBy = userId;

  await rating.save();
  return rating;
};

// =========================================================
// APPROVE VENDOR RATING & UPDATE VENDOR PERFORMANCE
// =========================================================
export const approveVendorRating = async ({ ratingId, userId }) => {
  const rating = await VendorRating.findOne({
    _id: ratingId,
    isDeleted: false,
  });

  if (!rating) throw new Error("Vendor rating not found.");
  if (rating.status !== "Submitted") {
    throw new Error("Only submitted ratings can be approved.");
  }

  rating.status = "Approved";
  rating.approvedBy = userId;
  rating.approvedAt = new Date();
  rating.updatedBy = userId;

  await rating.save();

  // Update Vendor performance summary with all 8 parameters preserving null semantics
  await Vendor.findByIdAndUpdate(rating.vendor, {
    $set: {
      "performance.deliveryScore": rating.delivery.finalScore ?? null,
      "performance.qualityScore": rating.quality.finalScore ?? null,
      "performance.fulfillmentScore": rating.fulfillment.finalScore ?? null,
      "performance.priceScore": rating.price.finalScore ?? null,
      "performance.responseTimeScore": rating.responseTime.finalScore ?? null,
      "performance.poAcceptanceScore": rating.poAcceptance.finalScore ?? null,
      "performance.documentationScore": rating.documentation.finalScore ?? null,
      "performance.communicationScore": rating.communication.finalScore ?? null,
      "performance.overallRating": rating.finalOverallScore ?? null,
      "performance.ratingCategory": rating.ratingCategory ?? null,
      "performance.lastEvaluatedAt": new Date(),
      "performance.totalOrders": rating.transactionSummary?.totalPurchaseOrders || 0,
      "performance.completedOrders": rating.transactionSummary?.completedPurchaseOrders || 0,
      updatedBy: userId,
    },
  });

  // 🔔 Notify vendor that new rating is available
  createForVendor(rating.vendor, {
    category: "vendor_rating",
    priority: "info",
    title: "New Vendor Rating Published",
    message: `Your rating for period ${rating.evaluationPeriod?.periodName || "recent"} has been published. Overall Score: ${rating.finalOverallScore ?? "N/A"}% (${rating.ratingCategory || "Evaluated"}).`,
    sourceModel: "VendorRating",
    sourceId: rating._id,
    actionUrl: "/vendor/performance",
    actionLabel: "View Performance Rating",
  });

  return rating;
};

// =========================================================
// LOCK VENDOR RATING
// =========================================================
export const lockVendorRating = async ({ ratingId, userId }) => {
  const rating = await VendorRating.findOne({
    _id: ratingId,
    isDeleted: false,
  });

  if (!rating) throw new Error("Vendor rating not found.");
  if (rating.status !== "Approved") {
    throw new Error("Only approved ratings can be locked.");
  }

  rating.status = "Locked";
  rating.lockedBy = userId;
  rating.lockedAt = new Date();
  rating.updatedBy = userId;

  await rating.save();
  return rating;
};

// =========================================================
// DELETE VENDOR RATING (SOFT DELETE)
// =========================================================
export const deleteVendorRating = async ({ ratingId, userId }) => {
  const rating = await VendorRating.findOne({
    _id: ratingId,
    isDeleted: false,
  });

  if (!rating) throw new Error("Vendor rating not found.");
  if (["Approved", "Locked"].includes(rating.status)) {
    throw new Error("Approved or locked ratings cannot be deleted.");
  }

  rating.isDeleted = true;
  rating.updatedBy = userId;

  await rating.save();
  return rating;
};

// =========================================================
// GET LATEST VENDOR RATING
// =========================================================
export const getLatestVendorRating = async (vendorId, { approvedOnly = false } = {}) => {
  if (!vendorId) throw new Error("Vendor ID is required.");

  const filter = {
    vendor: vendorId,
    isDeleted: false,
  };

  if (approvedOnly) {
    filter.status = { $in: ["Approved", "Locked"] };
  }

  return VendorRating.findOne(filter)
    .sort({ createdAt: -1 })
    .populate("vendor", "vendorCode vendorName vendorCategory status")
    .populate("evaluatedBy", "name email role")
    .populate("approvedBy", "name email role")
    .populate("lockedBy", "name email role");
};

// =========================================================
// GET VENDOR RATING DASHBOARD
// =========================================================
export const getVendorRatingDashboard = async (vendorId) => {
  // Return the latest approved/official rating if available, else latest active
  let latest = await getLatestVendorRating(vendorId, { approvedOnly: true });
  if (!latest) {
    latest = await getLatestVendorRating(vendorId, { approvedOnly: false });
  }

  if (!latest) {
    return {
      hasRating: false,
      vendorId,
      overallScore: null,
      ratingCategory: null,
      parameters: {},
    };
  }

  return {
    hasRating: true,
    vendorId,
    ratingId: latest._id,
    status: latest.status,
    isOfficial: ["Approved", "Locked"].includes(latest.status),
    overallScore: latest.finalOverallScore,
    systemOverallScore: latest.systemOverallScore,
    evaluatorOverallScore: latest.evaluatorOverallScore,
    ratingCategory: latest.ratingCategory,
    parameters: {
      delivery: {
        score: latest.delivery?.finalScore ?? latest.delivery?.systemScore ?? null,
        weight: latest.delivery?.weight ?? 30,
        dimensions: latest.delivery?.dimensions ?? null,
      },
      quality: {
        score: latest.quality?.finalScore ?? latest.quality?.systemScore ?? null,
        weight: latest.quality?.weight ?? 25,
      },
      fulfillment: {
        score: latest.fulfillment?.finalScore ?? latest.fulfillment?.systemScore ?? null,
        weight: latest.fulfillment?.weight ?? 15,
      },
      price: {
        score: latest.price?.finalScore ?? latest.price?.systemScore ?? null,
        weight: latest.price?.weight ?? 10,
      },
      responseTime: {
        score: latest.responseTime?.finalScore ?? latest.responseTime?.systemScore ?? null,
        weight: latest.responseTime?.weight ?? 5,
      },
      poAcceptance: {
        score: latest.poAcceptance?.finalScore ?? latest.poAcceptance?.systemScore ?? null,
        weight: latest.poAcceptance?.weight ?? 5,
      },
      documentation: {
        score: latest.documentation?.finalScore ?? latest.documentation?.systemScore ?? null,
        weight: latest.documentation?.weight ?? 5,
      },
      communication: {
        score: latest.communication?.finalScore ?? latest.communication?.systemScore ?? null,
        weight: latest.communication?.weight ?? 5,
      },
    },
    complaint: latest.complaint,
    replacementSummary: latest.replacementSummary,
    reInspectionSummary: latest.reInspectionSummary,
    transactionSummary: latest.transactionSummary,
    evaluationPeriod: latest.evaluationPeriod,
  };
};

/**
 * =========================================================
 * GET DELIVERY CALCULATION DETAILS (TRANSPARENCY ENGINE)
 * =========================================================
 */
export const getDeliveryCalculationDetails = async (ratingId) => {
  if (!ratingId) throw new Error("Rating ID is required.");

  let rating = null;
  if (mongoose.Types.ObjectId.isValid(ratingId)) {
    rating = await VendorRating.findOne({ _id: ratingId, isDeleted: false })
      .populate("vendor", "name code email phone")
      .lean();
  }

  // If not found by ID, check if ratingId is a vendor ID or find latest rating for this vendor
  if (!rating && mongoose.Types.ObjectId.isValid(ratingId)) {
    rating = await VendorRating.findOne({ vendor: ratingId, isDeleted: false })
      .populate("vendor", "name code email phone")
      .sort({ createdAt: -1 })
      .lean();
  }

  if (!rating) {
    throw new Error("Vendor rating not found.");
  }

  const vendorId = rating.vendor?._id || rating.vendor;
  const fromDate = rating.evaluationPeriod?.fromDate;
  const toDate = rating.evaluationPeriod?.toDate;

  const transactions = await getVendorTransactions({
    vendorId,
    fromDate,
    toDate,
  });

  const {
    purchaseOrders = [],
    dispatches = [],
    goodsReceipts = [],
    replacementRequests = [],
  } = transactions;

  const normalDispatches = dispatches.filter(
    (d) => !d.isDeleted && d.dispatchType !== "Replacement"
  );

  const normalReceipts = goodsReceipts.filter(
    (r) => !r.isDeleted && r.receiptType === "Normal" && r.status !== "Cancelled"
  );

  // Group Dispatches by PO to count multi-dispatches
  const poDispatchCounts = {};
  normalDispatches.forEach((d) => {
    const pId = String(d.purchaseOrder);
    poDispatchCounts[pId] = (poDispatchCounts[pId] || 0) + 1;
  });

  // Track itemized normal deliveries (Dispatch-driven for complete visibility)
  const normalDeliveries = [];
  let itemIndex = 1;
  let totalCalculatedWeightedScore = 0;
  let totalCalculatedReceivedQty = 0;
  const processedGRNIds = new Set();

  for (const dispatch of normalDispatches) {
    const matchedPO = purchaseOrders.find(
      (p) => String(p._id) === String(dispatch.purchaseOrder)
    );
    const matchedReceipt = normalReceipts.find(
      (r) => String(r.dispatch) === String(dispatch._id)
    );
    if (matchedReceipt) processedGRNIds.add(String(matchedReceipt._id));

    const poNumber = matchedPO?.poNumber || "PO-N/A";
    const dispatchNumber = dispatch.dispatchNumber || "DSP-N/A";

    const expectedDate =
      dispatch.expectedDeliveryDate || matchedPO?.expectedDeliveryDate;
    const dispatchDate = dispatch.dispatchDate;
    const receiptDate = matchedReceipt?.receiptDate || null;

    let dispatchType = "Full";
    const poCount = poDispatchCounts[String(dispatch.purchaseOrder)] || 1;
    if (dispatch.dispatchType === "Partial") {
      const remainingQty = (dispatch.items || []).reduce(
        (sum, it) => sum + toNumber(it.remainingQuantity),
        0
      );
      dispatchType = remainingQty === 0 ? "Final" : "Partial";
    } else if (poCount > 1) {
      dispatchType = "Multiple";
    }

    let delayDays = 0;
    let individualScore = 100;
    let status = "On Time";

    if (expectedDate && receiptDate) {
      const rawDiffDays = differenceInDays(expectedDate, receiptDate);
      delayDays = Math.max(0, rawDiffDays);
      if (delayDays === 0) {
        individualScore = 100;
        status = "On Time";
      } else if (delayDays === 1) {
        individualScore = 90;
        status = "1 Day Late";
      } else if (delayDays === 2) {
        individualScore = 80;
        status = "2 Days Late";
      } else if (delayDays === 3) {
        individualScore = 70;
        status = "3 Days Late";
      } else if (delayDays === 4) {
        individualScore = 60;
        status = "4 Days Late";
      } else {
        individualScore = 40;
        status = `${delayDays} Days Late`;
      }
    } else if (!receiptDate) {
      status = "In Transit";
      individualScore = 100;
    }

    for (const item of dispatch.items || []) {
      const dispatchedQty = toNumber(item.dispatchQuantity);
      const matchedPOItem = matchedPO?.items?.find(
        (p) => String(p.material) === String(item.material)
      );
      const orderedQty =
        toNumber(matchedPOItem?.quantity) ||
        toNumber(item.orderedQuantity) ||
        dispatchedQty;

      const matchedGRNItem = matchedReceipt?.items?.find(
        (g) => String(g.material) === String(item.material)
      );
      const receivedQty = matchedGRNItem
        ? toNumber(matchedGRNItem.receivedQuantity)
        : matchedReceipt
        ? dispatchedQty
        : 0;

      const weightedScore = round(receivedQty * individualScore);
      totalCalculatedWeightedScore += weightedScore;
      totalCalculatedReceivedQty += receivedQty;

      normalDeliveries.push({
        id: itemIndex++,
        poNumber,
        dispatchNumber,
        materialName: item.materialName || matchedPOItem?.materialName || "Material",
        materialCode: item.materialCode || matchedPOItem?.materialCode || "",
        dispatchType,
        orderedQuantity: round(orderedQty),
        dispatchedQuantity: round(dispatchedQty),
        receivedQuantity: round(receivedQty),
        dispatchDate: dispatchDate ? new Date(dispatchDate).toISOString() : null,
        expectedDate: expectedDate ? new Date(expectedDate).toISOString() : null,
        receiptDate: receiptDate ? new Date(receiptDate).toISOString() : null,
        delayDays,
        individualScore,
        weightedScore,
        status,
      });
    }
  }

  // Also include any standalone receipts not attached to a dispatch
  for (const receipt of normalReceipts) {
    if (processedGRNIds.has(String(receipt._id))) continue;
    const matchedPO = purchaseOrders.find(
      (p) => String(p._id) === String(receipt.purchaseOrder)
    );
    const poNumber = matchedPO?.poNumber || "PO-N/A";
    const expectedDate = matchedPO?.expectedDeliveryDate;
    const receiptDate = receipt.receiptDate;

    let delayDays = 0;
    let individualScore = 100;
    let status = "On Time";

    if (expectedDate && receiptDate) {
      const rawDiffDays = differenceInDays(expectedDate, receiptDate);
      delayDays = Math.max(0, rawDiffDays);
      if (delayDays === 0) {
        individualScore = 100;
        status = "On Time";
      } else if (delayDays >= 5) {
        individualScore = 40;
        status = `${delayDays} Days Late`;
      } else {
        individualScore = 100 - delayDays * 10;
        status = `${delayDays} Days Late`;
      }
    }

    for (const item of receipt.items || []) {
      const receivedQty = toNumber(item.receivedQuantity);
      if (receivedQty <= 0) continue;
      const weightedScore = round(receivedQty * individualScore);
      totalCalculatedWeightedScore += weightedScore;
      totalCalculatedReceivedQty += receivedQty;

      normalDeliveries.push({
        id: itemIndex++,
        poNumber,
        dispatchNumber: "GRN-DIRECT",
        materialName: item.materialName || "Material",
        materialCode: item.materialCode || "",
        dispatchType: "Full",
        orderedQuantity: toNumber(item.orderedQuantity) || receivedQty,
        dispatchedQuantity: toNumber(item.dispatchedQuantity) || receivedQty,
        receivedQuantity: round(receivedQty),
        dispatchDate: null,
        expectedDate: expectedDate ? new Date(expectedDate).toISOString() : null,
        receiptDate: receiptDate ? new Date(receiptDate).toISOString() : null,
        delayDays,
        individualScore,
        weightedScore,
        status,
      });
    }
  }

  // Track Replacement Evidence
  const replacementEvidence = [];
  let repIndex = 1;
  let repRequestedSum = 0;
  let repApprovedSum = 0;
  let repDispatchedSum = 0;
  let repReceivedSum = 0;
  let repAcceptedSum = 0;
  let repRejectedSum = 0;
  let repPendingSum = 0;
  let repDelayDaysSum = 0;
  let repDelayCount = 0;

  for (const rep of replacementRequests) {
    if (rep.isDeleted || rep.status === "Cancelled") continue;

    const matchedPO = purchaseOrders.find(
      (p) => String(p._id) === String(rep.purchaseOrder)
    );
    const matchedRepDispatch = dispatches.find(
      (d) =>
        String(d.replacementRequest) === String(rep._id) ||
        d.items?.some((i) => String(i.replacementRequest) === String(rep._id))
    );
    const matchedRepReceipt = goodsReceipts.find(
      (g) =>
        g.receiptType === "Replacement" &&
        (String(g.replacementRequest) === String(rep._id) ||
          (matchedRepDispatch && String(g.dispatch) === String(matchedRepDispatch._id)))
    );

    const requestDate = rep.requestedDate || rep.createdAt;
    const requiredDate = rep.requiredReplacementDate || rep.expectedReplacementDate;
    const actualDate = matchedRepReceipt?.receiptDate || rep.actualReplacementDate;

    let delayDays = 0;
    if (requiredDate && actualDate) {
      delayDays = Math.max(0, differenceInDays(requiredDate, actualDate));
      repDelayDaysSum += delayDays;
      repDelayCount += 1;
    }

    for (const item of rep.items || []) {
      const repQty = toNumber(item.replacementQuantity);
      repRequestedSum += repQty;
      repApprovedSum += toNumber(item.replacementApprovedQuantity);
      repDispatchedSum += toNumber(item.replacementDispatchedQuantity);
      repReceivedSum += toNumber(item.replacementReceivedQuantity);
      repAcceptedSum += toNumber(item.replacementAcceptedQuantity);
      repRejectedSum += toNumber(item.replacementRejectedQuantity);
      repPendingSum += toNumber(item.replacementPendingQuantity);

      replacementEvidence.push({
        id: repIndex++,
        replacementRequestNumber: rep.requestNumber || `RR-${rep._id.toString().slice(-4).toUpperCase()}`,
        originalPONumber: matchedPO?.poNumber || "PO-N/A",
        replacementDispatchNumber: matchedRepDispatch?.dispatchNumber || "R-DSP-N/A",
        materialName: item.materialName || "Material",
        replacementQuantity: round(repQty),
        requestDate: requestDate ? new Date(requestDate).toISOString() : null,
        requiredDate: requiredDate ? new Date(requiredDate).toISOString() : null,
        receiptDate: actualDate ? new Date(actualDate).toISOString() : null,
        delayDays,
        status: rep.status === "Approved" ? "Accepted" : rep.status,
      });
    }
  }

  const avgRepDelay = repDelayCount > 0 ? round(repDelayDaysSum / repDelayCount, 1) : 0;

  // Run dynamic calculation on actual transactions for 100% accurate 6-component results
  const calculatedDelivery = calculateDelivery({
    purchaseOrders,
    dispatches,
    goodsReceipts,
  });

  const deliverySnapshot = rating.delivery || {};
  const activeDimensions = deliverySnapshot.dimensions || calculatedDelivery.dimensions;

  // If rating document had no dimensions stored, persist them so database is up to date
  if (!deliverySnapshot.dimensions && calculatedDelivery.dimensions) {
    try {
      await VendorRating.findByIdAndUpdate(rating._id, {
        $set: { "delivery.dimensions": calculatedDelivery.dimensions },
      });
    } catch (e) {
      console.error("Error updating dimensions:", e.message);
    }
  }

  // Delivery score: respect evaluatorScore if manually adjusted, otherwise use composite score
  const deliveryScore =
    deliverySnapshot.evaluatorScore ??
    (deliverySnapshot.dimensions ? deliverySnapshot.finalScore : calculatedDelivery.finalScore) ??
    calculatedDelivery.finalScore ??
    0;
  const weight = deliverySnapshot.weight ?? 30;
  const overallContribution = round((deliveryScore * weight) / 100, 2);

  return {
    ratingId: rating._id,
    vendor: rating.vendor,
    evaluationPeriod: rating.evaluationPeriod,
    summary: {
      totalPOsEvaluated: calculatedDelivery.totalOrdersEvaluated ?? deliverySnapshot.totalOrdersEvaluated ?? purchaseOrders.length,
      totalDispatches: calculatedDelivery.totalDispatchesEvaluated ?? deliverySnapshot.totalDispatchesEvaluated ?? normalDispatches.length,
      orderedQuantity: calculatedDelivery.orderedQuantity ?? deliverySnapshot.orderedQuantity ?? 0,
      dispatchedQuantity: calculatedDelivery.dispatchedQuantity ?? deliverySnapshot.dispatchedQuantity ?? 0,
      receivedQuantity: calculatedDelivery.receivedQuantity ?? totalCalculatedReceivedQty,
      pendingQuantity: Math.max(0, (calculatedDelivery.orderedQuantity || deliverySnapshot.orderedQuantity || 0) - (calculatedDelivery.receivedQuantity || totalCalculatedReceivedQty)),
      onTimeQuantity: calculatedDelivery.onTimeQuantity ?? deliverySnapshot.onTimeQuantity ?? 0,
      delayedQuantity: calculatedDelivery.delayedQuantity ?? deliverySnapshot.delayedQuantity ?? 0,
      averageDelayDays: calculatedDelivery.averageDelayDays ?? deliverySnapshot.averageDelayDays ?? 0,
      partialDispatches: calculatedDelivery.partialDispatchCount ?? deliverySnapshot.partialDispatchCount ?? 0,
      multipleDispatchPOs: calculatedDelivery.multipleDispatchPOCount ?? deliverySnapshot.multipleDispatchPOCount ?? 0,
      replacementPOs: replacementRequests.length,
    },
    scoringRules: [
      { delayDays: "0 days (Early / On-time)", score: 100, status: "On Time" },
      { delayDays: "1 day late", score: 90, status: "Slight Delay" },
      { delayDays: "2 days late", score: 80, status: "Minor Delay" },
      { delayDays: "3 days late", score: 70, status: "Moderate Delay" },
      { delayDays: "4 days late", score: 60, status: "Major Delay" },
      { delayDays: "5+ days late", score: 40, status: "Severe Delay" },
    ],
    dimensions: activeDimensions,
    normalDeliveries,
    replacementEvidence,
    replacementSummary: {
      requestedQuantity: repRequestedSum,
      approvedQuantity: repApprovedSum,
      dispatchedQuantity: repDispatchedSum,
      receivedQuantity: repReceivedSum,
      acceptedQuantity: repAcceptedSum,
      rejectedQuantity: repRejectedSum,
      pendingQuantity: repPendingSum,
      averageDelayDays: avgRepDelay,
    },
    finalCalculation: {
      totalWeightedScore: totalCalculatedWeightedScore,
      totalReceivedQuantity: totalCalculatedReceivedQty,
      deliveryScore,
      weight,
      overallContribution,
      evaluatorScore: deliverySnapshot.evaluatorScore,
      adjustment: deliverySnapshot.adjustment,
      adjustmentReason: deliverySnapshot.adjustmentReason,
    },
  };
};

// =========================================================
// DEFAULT EXPORT
// =========================================================
const vendorRatingService = {
  generateVendorRating,
  getVendorRatings,
  getVendorRatingById,
  getDeliveryCalculationDetails,
  updateEvaluatorScores,
  submitVendorRating,
  approveVendorRating,
  lockVendorRating,
  deleteVendorRating,
  getLatestVendorRating,
  getVendorRatingDashboard,
};

export default vendorRatingService;
