import express from "express";

import {
  create,
  getAll,
  getOne,
  update,
  complete,
  getHistory,
  getEligibleReplacementMaterials,
} from "../controllers/reInspectionController.js";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware.js";


const router = express.Router();


// =========================================================
// RE-INSPECTION ROUTES
// =========================================================

// Create Re-Inspection
router.post(
  "/",
  protect,
  create
);


// Get all Re-Inspections
router.get(
  "/",
  protect,
  getAll
);

router.get(
  "/history/:originalInspectionId",
  protect,
  getHistory
);

router.get(
  "/replacement-materials/:originalInspectionId",
  protect,
  getEligibleReplacementMaterials
);


// Get single Re-Inspection
router.get(
  "/:id",
  protect,
  getOne
);


// Update Re-Inspection
router.put(
  "/:id",
  protect,
  update
);


// =========================================================
// FINAL DECISION / COMPLETE
// =========================================================

router.patch(
  "/:id/complete",
  protect,
  authorize(
    "SUPER_ADMIN",
    "ADMIN",
    "QUALITY_MANAGER",
    "PURCHASE_MANAGER"
  ),
  complete
);


export default router;
