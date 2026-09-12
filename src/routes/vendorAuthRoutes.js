import express from "express";
import { vendorLogin } from "../controllers/vendorAuthController.js";

const router = express.Router();

/**
 * ============================================
 * Vendor Authentication
 * ============================================
 */

// Vendor Login
router.post("/login", vendorLogin);

export default router;