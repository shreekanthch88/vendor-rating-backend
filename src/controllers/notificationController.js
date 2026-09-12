import asyncHandler from "express-async-handler";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
} from "../services/notificationService.js";

/**
 * GET /api/notifications
 * GET /api/vendor/notifications
 */
export const getNotificationsController = asyncHandler(async (req, res) => {
  const result = await getNotifications(req.user._id, req.query);
  res.status(200).json({ success: true, ...result });
});

/**
 * GET /api/notifications/unread-count
 * GET /api/vendor/notifications/unread-count
 */
export const getUnreadCountController = asyncHandler(async (req, res) => {
  const count = await getUnreadCount(req.user._id);
  res.status(200).json({ success: true, unreadCount: count });
});

/**
 * PATCH /api/notifications/mark-all-read
 * PATCH /api/vendor/notifications/mark-all-read
 */
export const markAllReadController = asyncHandler(async (req, res) => {
  await markAllAsRead(req.user._id);
  res.status(200).json({ success: true, message: "All notifications marked as read." });
});

/**
 * PATCH /api/notifications/:id/read
 * PATCH /api/vendor/notifications/:id/read
 */
export const markOneReadController = asyncHandler(async (req, res) => {
  const notification = await markAsRead(req.params.id, req.user._id);
  res.status(200).json({ success: true, data: notification });
});

/**
 * DELETE /api/notifications/clear-all
 * DELETE /api/vendor/notifications/clear-all
 */
export const clearAllNotificationsController = asyncHandler(async (req, res) => {
  await clearAllNotifications(req.user._id);
  res.status(200).json({ success: true, message: "All notifications cleared." });
});

/**
 * DELETE /api/notifications/:id
 * DELETE /api/vendor/notifications/:id
 */
export const deleteNotificationController = asyncHandler(async (req, res) => {
  await deleteNotification(req.params.id, req.user._id);
  res.status(200).json({ success: true, message: "Notification deleted." });
});
