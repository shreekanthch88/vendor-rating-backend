import express from "express";
import {
  register,
  login,
  changePassword,
} from "../controllers/authController.js";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/change-password", protect, changePassword);

router.get(
  "/profile",
  protect,
  (req, res) => {
    res.json({
      success: true,
      user: req.user,
    });
  }
);

router.get(
  "/admin",
  protect,
  authorize("SUPER_ADMIN"),
  (req, res) => {
    res.json({
      success: true,
      message: "Welcome Super Admin",
    });
  }
);

export default router;