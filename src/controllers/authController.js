import {
  registerUser,
  loginUser,
  changeUserPassword,
  requestPasswordResetOtp,
  resetUserPasswordWithOtp,
} from "../services/authService.js";

// Register
export const register = async (req, res) => {
  try {
    const data = await registerUser(req.body);

    res.status(201).json({
      success: true,
      user: {
        _id: data._id,
        name: data.name,
        email: data.email,
        role: data.role,
      },
      token: data.token,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const data = await loginUser(email, password);

    res.status(200).json({
      success: true,
      user: {
        _id: data._id,
        name: data.name,
        email: data.email,
        role: data.role,
      },
      token: data.token,
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error.message,
    });
  }
};

// Change Password (Self-Service)
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await changeUserPassword(
      req.user.id,
      currentPassword,
      newPassword
    );

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Request Password Reset OTP
export const forgotPassword = async (req, res) => {
  try {
    const { email, portal } = req.body;
    const result = await requestPasswordResetOtp(email, portal);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Reset Password With OTP
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword, portal } = req.body;
    const result = await resetUserPasswordWithOtp({
      email,
      otp,
      newPassword,
      portal,
    });

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
