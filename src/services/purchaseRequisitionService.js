import PurchaseRequisition from "../models/PurchaseRequisition.js";

/**
 * ==========================================
 * Generate PR Number
 * Format: PR000001
 * ==========================================
 */
const generatePRNumber = async () => {
  const requisitions = await PurchaseRequisition.find({
    prNumber: /^PR\d+$/i,
  }).select("prNumber");

  let maxNumber = 0;
  for (const doc of requisitions) {
    const num = parseInt(doc.prNumber.replace(/\D/g, ""), 10);
    if (!isNaN(num) && num > maxNumber) {
      maxNumber = num;
    }
  }

  let nextNumber = maxNumber + 1;
  let candidate = `PR${String(nextNumber).padStart(6, "0")}`;

  while (await PurchaseRequisition.exists({ prNumber: candidate })) {
    nextNumber += 1;
    candidate = `PR${String(nextNumber).padStart(6, "0")}`;
  }

  return candidate;
};

/**
 * ==========================================
 * Calculate Total Estimated Amount
 * ==========================================
 */
const calculateTotal = (items = []) => {
  return items.reduce((total, item) => {
    return (
      total +
      Number(item.quantity || 0) *
        Number(item.estimatedCost || 0)
    );
  }, 0);
};

/**
 * ==========================================
 * Create Purchase Requisition
 * ==========================================
 */
export const createPurchaseRequisition = async (
  data,
  userId
) => {
  const prNumber = await generatePRNumber();

  let items = Array.isArray(data.items) ? data.items : [];
  items = items.filter(
    (item) => item && item.material && String(item.material).trim() !== ""
  );

  const totalEstimatedAmount = calculateTotal(items);

  const requisition =
    await PurchaseRequisition.create({
      ...data,
      items,
      prNumber,
      requestedBy: userId,
      totalEstimatedAmount,
      createdBy: userId,
    });

  return requisition.populate([
    {
      path: "requestedBy",
      select: "name email",
    },
    {
      path: "items.material",
      select:
        "materialCode materialName unitOfMeasure",
    },
  ]);
};

/**
 * ==========================================
 * Get All Purchase Requisitions
 * ==========================================
 */
export const getAllPurchaseRequisitions =
  async ({
    page = 1,
    limit = 10,
    search = "",
    status = "",
    department = "",
    priority = "",
  }) => {
    const query = {
      isDeleted: false,
    };

    /**
     * Search PR Number & Purpose
     */
    if (search && search.trim()) {
      const sanitized = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        {
          prNumber: {
            $regex: sanitized,
            $options: "i",
          },
        },
        {
          purpose: {
            $regex: sanitized,
            $options: "i",
          },
        },
      ];
    }

    /**
     * Status Filter
     */
    if (status) {
      query.status = status;
    }

    /**
     * Department Filter
     */
    if (department) {
      query.department = department;
    }

    /**
     * Priority Filter
     *
     * Included for frontend compatibility.
     */
    if (priority) {
      query.priority = priority;
    }

    /**
     * Pagination
     */
    const currentPage = Math.max(
      Number(page) || 1,
      1
    );

    const pageLimit = Math.max(
      Number(limit) || 10,
      1
    );

    const skip =
      (currentPage - 1) * pageLimit;

    /**
     * Total Records
     */
    const total =
      await PurchaseRequisition.countDocuments(
        query
      );

    /**
     * Get Requisitions
     *
     * IMPORTANT:
     * Populate items.material so the frontend
     * receives materialCode, materialName and
     * unitOfMeasure.
     */
    const requisitions =
      await PurchaseRequisition.find(query)
        .populate(
          "requestedBy",
          "name email"
        )
        .populate(
          "approvedBy",
          "name email"
        )
        .populate(
          "items.material",
          "materialCode materialName unitOfMeasure"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageLimit);

    return {
      requisitions,
      total,
      page: currentPage,
      pages: Math.ceil(
        total / pageLimit
      ),
    };
  };

/**
 * ==========================================
 * Get Purchase Requisition By ID
 * ==========================================
 */
export const getPurchaseRequisitionById =
  async (id) => {
    return await PurchaseRequisition.findOne({
      _id: id,
      isDeleted: false,
    })
      .populate(
        "requestedBy",
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
 * ==========================================
 * Update Purchase Requisition
 * ==========================================
 */
export const updatePurchaseRequisition =
  async (
    id,
    data,
    userId
  ) => {
    const updatePayload = { ...data };

    if (updatePayload.items) {
      updatePayload.items = updatePayload.items.filter(
        (item) => item && item.material && String(item.material).trim() !== ""
      );
      updatePayload.totalEstimatedAmount =
        calculateTotal(updatePayload.items);
    }

    return await PurchaseRequisition.findByIdAndUpdate(
      id,
      {
        ...updatePayload,
        updatedBy: userId,
      },
      {
        new: true,
        runValidators: true,
      }
    )
      .populate(
        "requestedBy",
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
 * ==========================================
 * Submit Purchase Requisition
 * ==========================================
 */
export const submitPurchaseRequisition =
  async (
    id,
    userId
  ) => {
    return await PurchaseRequisition.findByIdAndUpdate(
      id,
      {
        status: "Submitted",
        updatedBy: userId,
      },
      {
        new: true,
      }
    )
      .populate(
        "requestedBy",
        "name email"
      )
      .populate(
        "items.material",
        "materialCode materialName unitOfMeasure"
      );
  };

/**
 * ==========================================
 * Approve Purchase Requisition
 * ==========================================
 */
export const approvePurchaseRequisition =
  async (
    id,
    userId
  ) => {
    return await PurchaseRequisition.findByIdAndUpdate(
      id,
      {
        status: "Approved",
        approvedBy: userId,
        approvedDate: new Date(),
        updatedBy: userId,
      },
      {
        new: true,
      }
    )
      .populate(
        "requestedBy",
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
 * ==========================================
 * Reject Purchase Requisition
 * ==========================================
 */
export const rejectPurchaseRequisition =
  async (
    id,
    reason,
    userId
  ) => {
    return await PurchaseRequisition.findByIdAndUpdate(
      id,
      {
        status: "Rejected",
        rejectionReason: reason,
        updatedBy: userId,
      },
      {
        new: true,
      }
    )
      .populate(
        "requestedBy",
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
 * ==========================================
 * Soft Delete Purchase Requisition
 * ==========================================
 */
export const deletePurchaseRequisition =
  async (
    id,
    userId
  ) => {
    return await PurchaseRequisition.findByIdAndUpdate(
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
 * ==========================================
 * Dashboard Summary
 * ==========================================
 */
export const getPurchaseRequisitionDashboard =
  async () => {
    const total =
      await PurchaseRequisition.countDocuments({
        isDeleted: false,
      });

    const draft =
      await PurchaseRequisition.countDocuments({
        status: "Draft",
        isDeleted: false,
      });

    const submitted =
      await PurchaseRequisition.countDocuments({
        status: "Submitted",
        isDeleted: false,
      });

    const approved =
      await PurchaseRequisition.countDocuments({
        status: "Approved",
        isDeleted: false,
      });

    const rejected =
      await PurchaseRequisition.countDocuments({
        status: "Rejected",
        isDeleted: false,
      });

    return {
      total,
      draft,
      submitted,
      approved,
      rejected,
    };
  };