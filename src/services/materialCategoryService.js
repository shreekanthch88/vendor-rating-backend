import MaterialCategory from "../models/MaterialCategory.js";
import Material from "../models/Material.js";

/**
 * Generate Category Code
 * Format: CAT0001
 */
const generateCategoryCode = async () => {
  const categories = await MaterialCategory.find({
    categoryCode: /^CAT\d+$/i,
  }).select("categoryCode");

  let maxNumber = 0;
  for (const doc of categories) {
    if (doc.categoryCode) {
      const num = parseInt(doc.categoryCode.replace(/\D/g, ""), 10);
      if (!isNaN(num) && num > maxNumber) {
        maxNumber = num;
      }
    }
  }

  let nextNumber = maxNumber + 1;
  let candidate = `CAT${String(nextNumber).padStart(4, "0")}`;

  while (await MaterialCategory.exists({ categoryCode: candidate })) {
    nextNumber++;
    candidate = `CAT${String(nextNumber).padStart(4, "0")}`;
  }

  return candidate;
};

/**
 * Create Material Category
 */
export const createCategory = async (categoryData, userId) => {
  const existingCategory = await MaterialCategory.findOne({
    categoryName: {
      $regex: new RegExp(`^${categoryData.categoryName}$`, "i"),
    },
    isDeleted: false,
  });

  if (existingCategory) {
    throw new Error("Category name already exists.");
  }

  const categoryCode = await generateCategoryCode();

  const category = await MaterialCategory.create({
    ...categoryData,
    categoryCode,
    createdBy: userId,
  });

  return category;
};

/**
 * Get All Categories
 */
export const getAllCategories = async (
  page = 1,
  limit = 10,
  search = "",
  status = ""
) => {
  const query = {
    isDeleted: false,
  };

  const trimmedSearch = typeof search === "string" ? search.trim() : "";
  if (trimmedSearch) {
    const escapedSearch = trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [
      {
        categoryName: {
          $regex: escapedSearch,
          $options: "i",
        },
      },
      {
        categoryCode: {
          $regex: escapedSearch,
          $options: "i",
        },
      },
      {
        description: {
          $regex: escapedSearch,
          $options: "i",
        },
      },
    ];
  }

  if (status) {
    query.status = status;
  }

  const total = await MaterialCategory.countDocuments(query);

  const categories = await MaterialCategory.find(query)
    .populate("parentCategory", "categoryName categoryCode")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  return {
    categories,
    total,
    page: Number(page),
    pages: Math.ceil(total / limit),
  };
};

/**
 * Get Category By ID
 */
export const getCategoryById = async (id) => {
  return await MaterialCategory.findById(id).populate(
    "parentCategory",
    "categoryName categoryCode"
  );
};

/**
 * Update Category
 */
export const updateCategory = async (id, data, userId) => {
  const duplicate = await MaterialCategory.findOne({
    _id: { $ne: id },
    categoryName: {
      $regex: new RegExp(`^${data.categoryName}$`, "i"),
    },
    isDeleted: false,
  });

  if (duplicate) {
    throw new Error("Category name already exists.");
  }

  if (data.parentCategory && data.parentCategory === id) {
    throw new Error("Category cannot be its own parent.");
  }

  return await MaterialCategory.findByIdAndUpdate(
    id,
    {
      ...data,
      updatedBy: userId,
    },
    {
      new: true,
      runValidators: true,
    }
  );
};

/**
 * Soft Delete Category
 */
export const deleteCategory = async (id, userId) => {
  const childCategory = await MaterialCategory.findOne({
    parentCategory: id,
    isDeleted: false,
  });

  if (childCategory) {
    throw new Error(
      "Cannot delete category because it has child categories."
    );
  }

  const linkedMaterialsCount = await Material.countDocuments({
    category: id,
    isDeleted: false,
  });

  if (linkedMaterialsCount > 0) {
    throw new Error(
      `Cannot delete category because ${linkedMaterialsCount} active material(s) are linked to it. Please reassign or delete the materials first.`
    );
  }

  return await MaterialCategory.findByIdAndUpdate(
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
 * Dashboard Summary
 */
export const getCategoryDashboard = async () => {
  const totalCategories = await MaterialCategory.countDocuments({
    isDeleted: false,
  });

  const activeCategories = await MaterialCategory.countDocuments({
    status: "Active",
    isDeleted: false,
  });

  const inactiveCategories = await MaterialCategory.countDocuments({
    status: "Inactive",
    isDeleted: false,
  });

  const rootCategories = await MaterialCategory.countDocuments({
    parentCategory: null,
    isDeleted: false,
  });

  return {
    totalCategories,
    activeCategories,
    inactiveCategories,
    rootCategories,
  };
};

/**
 * Get Category Hierarchy
 */
export const getCategoryHierarchy = async () => {
  return await MaterialCategory.find({
    isDeleted: false,
  })
    .select("categoryName categoryCode parentCategory status")
    .populate("parentCategory", "categoryName")
    .sort({ categoryName: 1 });
};