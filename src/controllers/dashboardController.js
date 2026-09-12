import { getDashboardAnalytics } from "../services/dashboardService.js";

export const getDashboard = async (req, res) => {
  try {
    const analytics = await getDashboardAnalytics();

    res.status(200).json({
      success: true,
      analytics,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};