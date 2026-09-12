import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  getCategoryDashboard,
  getCategoryHierarchy,
} from "../services/materialCategoryService.js";

/**
 * Create Material Category
 */
export const createMaterialCategory = async (req, res) => {
  try {
    const category = await createCategory(req.body, req.user._id);

    res.status(201).json({
      success: true,
      message: "Material category created successfully.",
      data: category,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get All Material Categories
 */
export const getMaterialCategories = async (req, res) => {
  try {
    const { page, limit, search, status } = req.query;

    const result = await getAllCategories(
      page,
      limit,
      search,
      status
    );

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get Material Category By ID
 */
export const getMaterialCategoryById = async (req, res) => {
  try {
    const category = await getCategoryById(req.params.id);

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Material category not found.",
      });
    }

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Update Material Category
 */
export const updateMaterialCategory = async (req, res) => {
  try {
    const category = await updateCategory(
      req.params.id,
      req.body,
      req.user._id
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Material category not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Material category updated successfully.",
      data: category,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Delete Material Category
 */
export const deleteMaterialCategory = async (req, res) => {
  try {
    const category = await deleteCategory(
      req.params.id,
      req.user._id
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Material category not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Material category deleted successfully.",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Material Category Dashboard
 */
export const getMaterialCategoryDashboard = async (req, res) => {
  try {
    const dashboard = await getCategoryDashboard();

    res.status(200).json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Material Category Hierarchy
 */
export const getMaterialCategoryHierarchy = async (req, res) => {
  try {
    const hierarchy = await getCategoryHierarchy();

    res.status(200).json({
      success: true,
      data: hierarchy,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};