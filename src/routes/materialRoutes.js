import express from "express";

import {
  createMaterialController,
  getMaterialsController,
  getMaterialByIdController,
  updateMaterialController,
  deleteMaterialController,
  getMaterialDashboardController,
} from "../controllers/materialController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Dashboard
 */
router.get(
  "/dashboard",
  protect,
  getMaterialDashboardController
);

/**
 * Materials
 */
router
  .route("/")
  .post(protect, createMaterialController)
  .get(protect, getMaterialsController);

/**
 * Material By ID
 */
router
  .route("/:id")
  .get(protect, getMaterialByIdController)
  .put(protect, updateMaterialController)
  .delete(protect, deleteMaterialController);

export default router;