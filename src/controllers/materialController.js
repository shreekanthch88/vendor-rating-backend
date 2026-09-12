import asyncHandler from "express-async-handler";

import {
  createMaterial,
  getAllMaterials,
  getMaterialById,
  updateMaterial,
  deleteMaterial,
  getMaterialDashboard,
} from "../services/materialService.js";

/**
 * @desc Create Material
 * @route POST /api/materials
 * @access Private
 */
export const createMaterialController = asyncHandler(async (req, res) => {
  const material = await createMaterial(req.body, req.user._id);

  res.status(201).json({
    success: true,
    message: "Material created successfully.",
    data: material,
  });
});

/**
 * @desc Get All Materials
 * @route GET /api/materials
 * @access Private
 */
export const getMaterialsController = asyncHandler(async (req, res) => {
  const result = await getAllMaterials(req.query);

  res.status(200).json({
    success: true,
    ...result,
  });
});

/**
 * @desc Get Material By ID
 * @route GET /api/materials/:id
 * @access Private
 */
export const getMaterialByIdController = asyncHandler(async (req, res) => {
  const material = await getMaterialById(req.params.id);

  res.status(200).json({
    success: true,
    data: material,
  });
});

/**
 * @desc Update Material
 * @route PUT /api/materials/:id
 * @access Private
 */
export const updateMaterialController = asyncHandler(async (req, res) => {
  const material = await updateMaterial(
    req.params.id,
    req.body,
    req.user._id
  );

  res.status(200).json({
    success: true,
    message: "Material updated successfully.",
    data: material,
  });
});

/**
 * @desc Delete Material
 * @route DELETE /api/materials/:id
 * @access Private
 */
export const deleteMaterialController = asyncHandler(async (req, res) => {
  const result = await deleteMaterial(
    req.params.id,
    req.user._id
  );

  res.status(200).json({
    success: true,
    ...result,
  });
});

/**
 * @desc Material Dashboard
 * @route GET /api/materials/dashboard
 * @access Private
 */
export const getMaterialDashboardController = asyncHandler(async (req, res) => {
  const dashboard = await getMaterialDashboard();

  res.status(200).json({
    success: true,
    data: dashboard,
  });
});