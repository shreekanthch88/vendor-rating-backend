import paymentService from "../services/paymentService.js";

/**
 * =========================================================
 * Payment Controller
 * =========================================================
 */

// 1. Get Payment Dashboard Statistics
export const getPaymentDashboard = async (req, res, next) => {
  try {
    const stats = await paymentService.getPaymentDashboardStats(req.user);
    res.status(200).json({
      success: true,
      message: "Payment dashboard statistics fetched successfully.",
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get Payment Queue (Approved Invoices ready for disbursement)
export const getPaymentQueue = async (req, res, next) => {
  try {
    const result = await paymentService.getPaymentQueue(req.query, req.user);
    res.status(200).json({
      success: true,
      message: "Payment queue fetched successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 3. Process Payment (Record Disbursement)
export const processPayment = async (req, res, next) => {
  try {
    const payment = await paymentService.processPayment(req.body, req.user._id);
    res.status(201).json({
      success: true,
      message: "Payment processed successfully.",
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

// 4. Get All Payments (Listing & History)
export const getAllPayments = async (req, res, next) => {
  try {
    const result = await paymentService.getAllPayments(req.query, req.user);
    res.status(200).json({
      success: true,
      message: "Payments fetched successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// 5. Get Payment By ID
export const getPaymentById = async (req, res, next) => {
  try {
    const payment = await paymentService.getPaymentById(req.params.id, req.user);
    res.status(200).json({
      success: true,
      message: "Payment details fetched successfully.",
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

// 6. Update Payment Status (Exception handling)
export const updatePaymentStatus = async (req, res, next) => {
  try {
    const payment = await paymentService.updatePaymentStatus(
      req.params.id,
      req.body,
      req.user._id
    );
    res.status(200).json({
      success: true,
      message: "Payment status updated successfully.",
      data: payment,
    });
  } catch (error) {
    next(error);
  }
};

const paymentController = {
  getPaymentDashboard,
  getPaymentQueue,
  processPayment,
  getAllPayments,
  getPaymentById,
  updatePaymentStatus,
};

export default paymentController;

