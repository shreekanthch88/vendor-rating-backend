import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import { verifyEmailConnection } from "./services/emailService.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import vendorRoutes from "./routes/vendorRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import materialCategoryRoutes from "./routes/materialCategoryRoutes.js";
import materialRoutes from "./routes/materialRoutes.js";
import purchaseRequisitionRoutes from "./routes/purchaseRequisitionRoutes.js";
import purchaseOrderRoutes from "./routes/purchaseOrderRoutes.js";
import vendorAuthRoutes from "./routes/vendorAuthRoutes.js";
import vendorPurchaseOrderRoutes from "./routes/vendorPurchaseOrderRoutes.js";
import vendorDispatchRoutes from "./routes/vendorDispatchRoutes.js";
import replacementRequestRoutes from "./routes/replacementRequestRoutes.js";
import organizationReplacementRequestRoutes
  from "./routes/organizationReplacementRequestRoutes.js";

import goodsReceiptRoutes from "./routes/goodsReceiptRoutes.js";
import qualityInspectionRoutes from "./routes/qualityInspectionRoutes.js";
import reInspectionRoutes from "./routes/reInspectionRoutes.js";
import vendorRatingRoutes from "./routes/vendorRatingRoutes.js";
import vendorRatingDashboardRoutes from "./routes/vendorRatingDashboardRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import vendorNotificationRoutes from "./routes/vendorNotificationRoutes.js";


import { errorHandler } from "./middleware/errorMiddleware.js";

dotenv.config();

const app = express();

// ===========================================
// Middleware
// ===========================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors());

app.use(cookieParser());

app.use(helmet());

app.use(morgan("dev"));


// ===========================================
// Health Check Endpoint (For Vercel / Cloud Diagnostics)
// ===========================================
app.get("/api/health", async (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  let emailStatus = "checking";
  try {
    const isEmailOk = await verifyEmailConnection();
    emailStatus = isEmailOk ? "Connected (SMTP Verified)" : "Failed (Check credentials)";
  } catch (err) {
    emailStatus = "Error: " + err.message;
  }

  return res.status(200).json({
    status: isDbConnected ? "Healthy" : "Degraded",
    database: isDbConnected ? "Connected (MongoDB Atlas)" : "Disconnected",
    email: emailStatus,
    timestamp: new Date().toISOString(),
  });
});

// ===========================================
// Routes
// ===========================================

// Authentication
app.use(
  "/api/auth",
  authRoutes
);

// Users
app.use(
  "/api/users",
  userRoutes
);

// Vendors
app.use(
  "/api/vendors",
  vendorRoutes
);

// Dashboard
app.use(
  "/api/dashboard",
  dashboardRoutes
);

// Material Categories
app.use(
  "/api/material-categories",
  materialCategoryRoutes
);

// Materials
app.use(
  "/api/materials",
  materialRoutes
);

// Purchase Requisitions
app.use(
  "/api/purchase-requisitions",
  purchaseRequisitionRoutes
);

// Admin / Purchase Manager Purchase Orders
app.use(
  "/api/purchase-orders",
  purchaseOrderRoutes
);

// Vendor Authentication
app.use(
  "/api/vendor",
  vendorAuthRoutes
);

// Vendor Purchase Orders
app.use(
  "/api/vendor/purchase-orders",
  vendorPurchaseOrderRoutes
);

app.use(
  "/api/vendor/dispatches",
  vendorDispatchRoutes
);

app.use(
  "/api/vendor/replacement-requests",
  replacementRequestRoutes
);


app.use(
  "/api/replacement-requests",
  organizationReplacementRequestRoutes
);

// Goods Receipt / GRN

app.use(
  "/api/goods-receipts",
  goodsReceiptRoutes
);

// Quality Inspections

app.use(
  "/api/quality-inspections",
  qualityInspectionRoutes
);

app.use(
  "/api/re-inspections",
  reInspectionRoutes
);

// Vendor Ratings

app.use(
  "/api/vendor-ratings",
  vendorRatingRoutes
);

app.use(
  "/api/vendor-rating-dashboard",
  vendorRatingDashboardRoutes
);

// Invoices
app.use(
  "/api/invoices",
  invoiceRoutes
);

app.use(
  "/api/vendor/invoices",
  invoiceRoutes
);

// Payments
app.use(
  "/api/payments",
  paymentRoutes
);

app.use(
  "/api/vendor/payments",
  paymentRoutes
);

// Notifications (Admin / Staff)
app.use(
  "/api/notifications",
  notificationRoutes
);

// Notifications (Vendor)
app.use(
  "/api/vendor/notifications",
  vendorNotificationRoutes
);


// ===========================================
// Error Handler
// ===========================================

app.use(errorHandler);


// ===========================================
// Test Route
// ===========================================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message:
      "Vendor Rating Mechanism API is running...",
  });
});


export default app;