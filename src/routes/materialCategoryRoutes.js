import express from "express";

import {
  createMaterialCategory,
  getMaterialCategories,
  getMaterialCategoryById,
  updateMaterialCategory,
  deleteMaterialCategory,
  getMaterialCategoryDashboard,
  getMaterialCategoryHierarchy,
} from "../controllers/materialCategoryController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Dashboard
 */
router.get("/dashboard", protect, getMaterialCategoryDashboard);

/**
 * Category Hierarchy
 */
router.get("/hierarchy", protect, getMaterialCategoryHierarchy);

/**
 * Get All Categories
 * Create Category
 */
router
  .route("/")
  .get(protect, getMaterialCategories)
  .post(protect, createMaterialCategory);

/**
 * Get By Id
 * Update
 * Delete
 */
router
  .route("/:id")
  .get(protect, getMaterialCategoryById)
  .put(protect, updateMaterialCategory)
  .delete(protect, deleteMaterialCategory);

export default router;