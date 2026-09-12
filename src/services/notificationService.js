import os from "os";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { sendEmail } from "./emailService.js";

// =========================================================
// INTERNAL — BUILD EMAIL ACTION URL
// =========================================================

const getActiveLocalIp = () => {
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === "IPv4" && !net.internal) {
          return net.address;
        }
      }
    }
  } catch (err) {
    console.warn("Could not determine local IP:", err?.message);
  }
  return null;
};

export const getFrontendBaseUrl = () => {
  const configured = (
    process.env.FRONTEND_URL || "http://localhost:5173"
  ).trim().replace(/\/$/, "");

  const activeIp = getActiveLocalIp();
  if (!activeIp) {
    return configured;
  }

  try {
    const parsed = new URL(configured);
    const isPrivateLanIp = /^(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(
      parsed.hostname
    );

    if (isPrivateLanIp && parsed.hostname !== activeIp) {
      console.log(
        `🔄 Auto-adjusting email link host from ${parsed.hostname} to active Wi-Fi IP ${activeIp}`
      );
      parsed.hostname = activeIp;
      return parsed.toString().replace(/\/$/, "");
    }
  } catch {
    // Fall back to configured string
  }

  return configured;
};

export const getEmailActionUrl = (actionUrl) => {
  if (!actionUrl) {
    return null;
  }

  // If the URL is already absolute, use it as-is.
  if (/^https?:\/\//i.test(actionUrl)) {
    return actionUrl;
  }

  const baseUrl = getFrontendBaseUrl();

  return `${baseUrl}${
    actionUrl.startsWith("/") ? actionUrl : `/${actionUrl}`
  }`;
};

/**
 * =========================================================
 * NOTIFICATION SERVICE
 * =========================================================
 *
 * Fire-and-forget:
 *
 * Notification failures and email failures must never break
 * the underlying business workflow.
 *
 * Flow:
 *
 * Business Event
 *      ↓
 * Notification Service
 *      ├── Create In-App Notification
 *      └── Send Email
 *
 * Email sending is intentionally handled here rather than
 * directly inside Purchase Order / Dispatch / GRN / Quality
 * services.
 */

// =========================================================
// INTERNAL — SAFE CREATE
// =========================================================

const safeCreate = async (payload) => {
  try {
    return await Notification.create(payload);
  } catch (err) {
    console.warn(
      "[NotificationService] Failed to create notification:",
      err.message
    );

    return null;
  }
};

// =========================================================
// INTERNAL — SAFE EMAIL
// =========================================================

const safeSendEmail = async ({
  to,
  title,
  message,
  priority = "info",
  actionUrl = null,
  actionLabel = "View",
}) => {
  try {
    const emailActionUrl = getEmailActionUrl(actionUrl);

    if (!to) {
      return;
    }

    const priorityText =
      priority === "critical"
        ? "Critical"
        : priority === "action"
          ? "Action Required"
          : "Information";

    const actionText = emailActionUrl
      ? `
Open the application:
${emailActionUrl}
      `.trim()
      : "";

    await sendEmail({
      to,

      subject: title,

      text: `
Vendor Rating Mechanism

${title}

${message}

Priority: ${priorityText}

${actionText}

Regards,
Vendor Rating Mechanism
      `.trim(),

      html: `
        <div
          style="
            font-family: Arial, Helvetica, sans-serif;
            line-height: 1.6;
            color: #222;
            max-width: 700px;
            margin: 0 auto;
          "
        >

          <h2 style="margin-bottom: 20px;">
            Vendor Rating Mechanism
          </h2>

          <h3>
            ${title}
          </h3>

          <p>
            ${message}
          </p>

          <p>
            <strong>Priority:</strong>
            ${priorityText}
          </p>

          ${
            emailActionUrl
              ? `
                <p style="margin-top: 24px;">
                  <a
                    href="${emailActionUrl}"
                    style="
                      display: inline-block;
                      padding: 10px 18px;
                      background: #2563eb;
                      color: #ffffff;
                      text-decoration: none;
                      border-radius: 6px;
                    "
                  >
                    ${actionLabel}
                  </a>
                </p>
              `
              : ""
          }

          <p style="margin-top: 30px;">
            Regards,<br />
            <strong>Vendor Rating Mechanism</strong>
          </p>

        </div>
      `,
    });

  } catch (err) {
    console.warn(
      "[NotificationService] Failed to send notification email:",
      err.message
    );
  }
};

// =========================================================
// CREATE A SINGLE NOTIFICATION FOR ONE USER
// =========================================================

export const createNotification = async ({
  recipientId,
  recipientRole,
  vendorId = null,
  category,
  priority = "info",
  title,
  message,
  sourceModel = null,
  sourceId = null,
  actionUrl = null,
  actionLabel = "View",

  // Email is enabled by default.
  // Set sendEmailNotification: false when an event should
  // create only an in-app notification.
  sendEmailNotification = true,
}) => {

  try {

    // =====================================================
    // FIND RECIPIENT
    // =====================================================

    const user = await User.findById(recipientId)
      .select("_id email")
      .lean();

    if (!user) {
      console.warn(
        "[NotificationService] Recipient user not found:",
        recipientId
      );

      return;
    }

    // =====================================================
    // CREATE IN-APP NOTIFICATION
    // =====================================================

    const notification = await safeCreate({
      recipient: recipientId,
      recipientRole,
      vendor: vendorId || null,
      category,
      priority,
      title,
      message,
      sourceModel,
      sourceId,
      actionUrl,
      actionLabel,
    });

    // =====================================================
    // SEND EMAIL
    // =====================================================

    if (
      notification &&
      sendEmailNotification &&
      user.email
    ) {
      await safeSendEmail({
        to: user.email,
        title,
        message,
        priority,
        actionUrl,
        actionLabel,
      });
    }

  } catch (err) {

    console.warn(
      "[NotificationService] createNotification failed:",
      err.message
    );

  }
};

// =========================================================
// CREATE FOR ALL USERS OF A GIVEN ROLE
// =========================================================

export const createForRole = async (
  roles,
  payload
) => {

  try {

    const roleArray =
      Array.isArray(roles)
        ? roles
        : [roles];

    // =====================================================
    // EXTRACT EMAIL CONTROL FROM PAYLOAD
    // =====================================================

    const {
      sendEmailNotification = true,
      ...notificationPayload
    } = payload;

    // =====================================================
    // FIND ACTIVE USERS
    // =====================================================

    const users = await User.find({
      role: {
        $in: roleArray,
      },
      status: { $ne: "INACTIVE" },
    })
      .select("_id role email")
      .lean();

    if (!users.length) {
      return;
    }

    // =====================================================
    // CREATE IN-APP NOTIFICATIONS
    // =====================================================

    const docs = users.map((u) => ({
      recipient: u._id,
      recipientRole: u.role,
      vendor: null,
      ...notificationPayload,
    }));

    await Notification.insertMany(
      docs,
      {
        ordered: false,
      }
    );

    // =====================================================
    // SEND EMAILS
    // =====================================================

    if (sendEmailNotification) {

      await Promise.allSettled(
        users.map((user) =>
          safeSendEmail({
            to: user.email,
            title: notificationPayload.title,
            message: notificationPayload.message,
            priority:
              notificationPayload.priority || "info",
            actionUrl:
              notificationPayload.actionUrl || null,
            actionLabel:
              notificationPayload.actionLabel || "View",
          })
        )
      );

    }

  } catch (err) {

    console.warn(
      "[NotificationService] createForRole failed:",
      err.message
    );

  }
};

// =========================================================
// CREATE FOR ALL USERS BELONGING TO A VENDOR
// =========================================================

export const createForVendor = async (
  vendorId,
  payload
) => {

  try {

    if (!vendorId) {
      return;
    }

    // =====================================================
    // EXTRACT EMAIL CONTROL FROM PAYLOAD
    // =====================================================

    const {
      sendEmailNotification = true,
      ...notificationPayload
    } = payload;

    // =====================================================
    // FIND ACTIVE VENDOR USERS
    // =====================================================

    const users = await User.find({

      vendor: vendorId,

      role: "VENDOR",

      status: "ACTIVE",

    })
      .select("_id role vendor email")
      .lean();

    if (!users.length) {
      return;
    }

    // =====================================================
    // CREATE IN-APP NOTIFICATIONS
    // =====================================================

    const docs = users.map((u) => ({
      recipient: u._id,
      recipientRole: "VENDOR",
      vendor: vendorId,
      ...notificationPayload,
    }));

    await Notification.insertMany(
      docs,
      {
        ordered: false,
      }
    );

    // =====================================================
    // SEND EMAILS
    // =====================================================

    if (sendEmailNotification) {

      await Promise.allSettled(
        users.map((user) =>
          safeSendEmail({
            to: user.email,
            title: notificationPayload.title,
            message: notificationPayload.message,
            priority:
              notificationPayload.priority || "info",
            actionUrl:
              notificationPayload.actionUrl || null,
            actionLabel:
              notificationPayload.actionLabel || "View",
          })
        )
      );

    }

  } catch (err) {

    console.warn(
      "[NotificationService] createForVendor failed:",
      err.message
    );

  }
};

// =========================================================
// GET NOTIFICATIONS FOR A USER
// =========================================================

export const getNotifications = async (
  userId,
  {
    page = 1,
    limit = 20,
    filter = "all",
    category = "",
  } = {}
) => {

  const query = {
    recipient: userId,
    isDeleted: false,
  };

  if (filter === "unread") {
    query.isRead = false;
  }

  if (filter === "action") {
    query.priority = "action";
  }

  if (filter === "critical") {
    query.priority = "critical";
  }

  if (category) {
    query.category = category;
  }

  const safePage =
    Math.max(
      1,
      Number(page) || 1
    );

  const safeLimit =
    Math.max(
      1,
      Number(limit) || 20
    );

  const skip =
    (safePage - 1) *
    safeLimit;

  const [
    notifications,
    total,
    unreadCount,
  ] = await Promise.all([

    Notification.find(query)
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(safeLimit)
      .lean(),

    Notification.countDocuments(
      query
    ),

    Notification.countDocuments({
      recipient: userId,
      isDeleted: false,
      isRead: false,
    }),

  ]);

  return {

    notifications,

    total,

    unreadCount,

    page: safePage,

    pages:
      Math.ceil(
        total / safeLimit
      ),

  };
};

// =========================================================
// GET UNREAD COUNT
// =========================================================

export const getUnreadCount = async (
  userId
) => {

  try {

    const count =
      await Notification.countDocuments({

        recipient: userId,

        isRead: false,

        isDeleted: false,

      });

    return count;

  } catch (err) {

    console.warn(
      "[NotificationService] getUnreadCount failed:",
      err.message
    );

    return 0;
  }
};

// =========================================================
// MARK ONE AS READ
// =========================================================

export const markAsRead = async (
  notificationId,
  userId
) => {

  const notification =
    await Notification.findOne({

      _id: notificationId,

      recipient: userId,

      isDeleted: false,

    });

  if (!notification) {

    throw new Error(
      "Notification not found."
    );

  }

  if (!notification.isRead) {

    notification.isRead = true;

    notification.readAt =
      new Date();

    await notification.save();

  }

  return notification;
};

// =========================================================
// MARK ALL AS READ
// =========================================================

export const markAllAsRead = async (
  userId
) => {

  await Notification.updateMany(

    {
      recipient: userId,
      isRead: false,
      isDeleted: false,
    },

    {
      $set: {
        isRead: true,
        readAt: new Date(),
      },
    }

  );

};

// =========================================================
// DELETE — SOFT DELETE
// =========================================================

export const deleteNotification = async (
  notificationId,
  userId
) => {

  const notification =
    await Notification.findOne({

      _id: notificationId,

      recipient: userId,

      isDeleted: false,

    });

  if (!notification) {

    throw new Error(
      "Notification not found."
    );

  }

  notification.isDeleted =
    true;

  await notification.save();
};

// =========================================================
// CLEAR ALL — SOFT DELETE ALL FOR USER
// =========================================================

export const clearAllNotifications = async (userId) => {
  await Notification.updateMany(
    {
      recipient: userId,
      isDeleted: false,
    },
    {
      $set: {
        isDeleted: true,
      },
    }
  );
};