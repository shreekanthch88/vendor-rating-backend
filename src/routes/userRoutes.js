import express from "express";

import {
  getUsers,
  getUser,
  addUser,
  editUser,
  changeUserStatus,
  removeUser,
  resetPassword,
} from "../controllers/userController.js";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| User Routes (Protected: SUPER_ADMIN & ADMIN only)
|--------------------------------------------------------------------------
*/

router.use(protect);
router.use(authorize("SUPER_ADMIN", "ADMIN"));

// Get all users
router.get("/", getUsers);

// Get single user
router.get("/:id", getUser);

// Create user
router.post("/", addUser);

// Update user
router.put("/:id", editUser);

// Update status
router.patch("/:id/status", changeUserStatus);

// Reset password (Admin)
router.patch("/:id/reset-password", resetPassword);

// Soft delete
router.delete("/:id", removeUser);

export default router;