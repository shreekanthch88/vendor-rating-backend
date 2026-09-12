import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getNotificationsController,
  getUnreadCountController,
  markAllReadController,
  markOneReadController,
  deleteNotificationController,
  clearAllNotificationsController,
} from "../controllers/notificationController.js";

const router = express.Router();

router.use(protect);

router.get("/",                  getNotificationsController);
router.get("/unread-count",      getUnreadCountController);
router.patch("/mark-all-read",   markAllReadController);
router.patch("/:id/read",        markOneReadController);
router.delete("/clear-all",      clearAllNotificationsController);
router.delete("/:id",            deleteNotificationController);

export default router;
