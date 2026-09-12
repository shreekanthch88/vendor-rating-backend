import Material from "../models/Material.js";
import MaterialCategory from "../models/MaterialCategory.js";
import PurchaseOrder from "../models/PurchaseOrder.js";

/**
 * Generate Material Code
 */
const generateMaterialCode = async () => {
  const lastMaterial = await Material.findOne({})
    .sort({ createdAt: -1 })
    .select("materialCode");

  if (!lastMaterial) return "MAT0001";

  const lastNumber = parseInt(
    lastMaterial.materialCode.replace("MAT", ""),
    10
  );

  return `MAT${String(lastNumber + 1).padStart(4, "0")}`;
};

/**
 * Create Material
 */
export const createMaterial = async (data, userId) => {
  const trimmedName = data.materialName?.trim();

  if (!trimmedName) {
    throw new Error("Material name is required.");
  }

  const existingMaterial = await Material.findOne({
    materialName: {
      $regex: new RegExp(`^${trimmedName}$`, "i"),
    },
    isDeleted: false,
  });

  if (existingMaterial) {
    throw new Error("Material name already exists.");
  }

  if (data.category) {
    const categoryExists = await MaterialCategory.findOne({
      _id: data.category,
      isDeleted: false,
    });

    if (!categoryExists) {
      throw new Error("Selected material category does not exist.");
    }
  }

  const materialCode = await generateMaterialCode();

  const material = await Material.create({
    ...data,
    materialName: trimmedName,
    materialCode,
    createdBy: userId,
  });

  return await Material.findById(material._id)
    .populate("category", "categoryName categoryCode")
    .populate("preferredVendor", "vendorName vendorCode");
};

/**
 * Get All Materials
 */
export const getAllMaterials = async ({
  page = 1,
  limit = 10,
  search = "",
  status = "",
  category = "",
}) => {
  const query = {
    isDeleted: false,
  };

  if (search) {
    query.$or = [
      {
        materialName: {
          $regex: search,
          $options: "i",
        },
      },
      {
        materialCode: {
          $regex: search,
          $options: "i",
        },
      },
    ];
  }

  if (status) {
    query.status = status;
  }

  if (category) {
    query.category = category;
  }

  const total = await Material.countDocuments(query);

  const materials = await Material.find(query)
    .populate("category", "categoryName categoryCode")
    .populate("preferredVendor", "vendorName vendorCode")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  return {
    materials,
    total,
    page: Number(page),
    pages: Math.ceil(total / limit),
  };
};

/**
 * Get Material By ID
 */
export const getMaterialById = async (id) => {
  const material = await Material.findOne({
    _id: id,
    isDeleted: false,
  })
    .populate("category", "categoryName categoryCode")
    .populate("preferredVendor", "vendorName vendorCode")
    .populate("createdBy", "name")
    .populate("updatedBy", "name");

  if (!material) {
    throw new Error("Material not found.");
  }

  return material;
};

/**
 * Update Material
 */
export const updateMaterial = async (
  id,
  data,
  userId
) => {
  const updatePayload = { ...data };

  if (data.materialName) {
    const trimmedName = data.materialName.trim();

    if (!trimmedName) {
      throw new Error("Material name cannot be empty.");
    }

    const duplicate = await Material.findOne({
      materialName: {
        $regex: new RegExp(`^${trimmedName}$`, "i"),
      },
      _id: { $ne: id },
      isDeleted: false,
    });

    if (duplicate) {
      throw new Error("Material name already exists.");
    }

    updatePayload.materialName = trimmedName;
  }

  if (data.category) {
    const categoryExists = await MaterialCategory.findOne({
      _id: data.category,
      isDeleted: false,
    });

    if (!categoryExists) {
      throw new Error("Selected material category does not exist.");
    }
  }

  const material = await Material.findByIdAndUpdate(
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
    .populate("category", "categoryName categoryCode")
    .populate("preferredVendor", "vendorName vendorCode");

  if (!material) {
    throw new Error("Material not found.");
  }

  return material;
};

/**
 * Delete Material (Soft Delete)
 */
export const deleteMaterial = async (
  id,
  userId
) => {
  const material = await Material.findById(id);

  if (!material || material.isDeleted) {
    throw new Error("Material not found.");
  }

  // Check if material is referenced in active/open Purchase Orders
  const activePO = await PurchaseOrder.findOne({
    "items.material": id,
    isDeleted: false,
    status: {
      $in: ["Approved", "Issued", "Accepted", "Dispatched", "In Transit", "Partially Delivered"],
    },
  }).select("poNumber");

  if (activePO) {
    throw new Error(
      `Cannot delete material because it is part of active Purchase Order ${activePO.poNumber}.`
    );
  }

  material.isDeleted = true;
  material.updatedBy = userId;

  await material.save();

  return {
    message: "Material deleted successfully.",
  };
};

/**
 * Material Dashboard
 */
export const getMaterialDashboard = async () => {
  const totalMaterials =
    await Material.countDocuments({
      isDeleted: false,
    });

  const activeMaterials =
    await Material.countDocuments({
      status: "Active",
      isDeleted: false,
    });

  const inactiveMaterials =
    await Material.countDocuments({
      status: "Inactive",
      isDeleted: false,
    });

  return {
    totalMaterials,
    activeMaterials,
    inactiveMaterials,
  };
};