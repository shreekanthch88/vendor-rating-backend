import * as vendorAuthService from "../services/vendorAuthService.js";

/**
 * =====================================================
 * Vendor Login
 * POST /api/vendor/login
 * =====================================================
 */
export const vendorLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const data = await vendorAuthService.vendorLogin(
      email,
      password
    );

    res.status(200).json(data);
  } catch (error) {
    console.error("Vendor Login Error:", error);

    res.status(401).json({
      success: false,
      message: error.message,
    });
  }
};