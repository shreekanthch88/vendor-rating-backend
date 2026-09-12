import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipientRole: {
      type: String,
      enum: ["SUPER_ADMIN","ADMIN","PURCHASE_MANAGER","QUALITY_MANAGER","FINANCE_MANAGER","VIEWER","VENDOR"],
      required: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
      index: true,
    },
    category: {
      type: String,
      enum: ["purchase_order","dispatch","goods_receipt","quality_inspection","re_inspection","replacement","invoice","payment","vendor_rating","system"],
      required: true,
    },
    priority: {
      type: String,
      enum: ["info", "action", "critical"],
      default: "info",
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    sourceModel: { type: String, default: null },
    sourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    actionUrl: { type: String, default: null },
    actionLabel: { type: String, default: "View" },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isDeleted: 1, createdAt: -1 });
notificationSchema.index({ vendor: 1, isDeleted: 1, createdAt: -1 });

export default mongoose.model("Notification", notificationSchema);
