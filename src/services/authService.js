import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";

export const registerUser = async (userData) => {
  const { name, email, password, role } = userData;

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new Error("User already exists");
  }

  // Check if this is the very first user in the system (initial bootstrap)
  const totalUsers = await User.countDocuments();
  let assignedRole = "VIEWER";

  if (totalUsers === 0) {
    // Initial system setup: first user is SUPER_ADMIN
    assignedRole = "SUPER_ADMIN";
  } else if (role && role !== "VIEWER") {
    throw new Error(
      "Privileged roles cannot be self-assigned. Please contact an administrator."
    );
  }

  const user = await User.create({
    name,
    email,
    password,
    role: assignedRole,
  });

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    token: generateToken(user._id, user.role),
  };
};

export const loginUser = async (email, password) => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new Error("Invalid email or password");
  }

  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    throw new Error("Invalid email or password");
  }

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    token: generateToken(user._id, user.role),
  };
};

export const changeUserPassword = async (
  userId,
  currentPassword,
  newPassword
) => {
  if (!currentPassword || !newPassword) {
    throw new Error("Current password and new password are required.");
  }

  if (newPassword.length < 6) {
    throw new Error("New password must be at least 6 characters.");
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error("User not found.");
  }

  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) {
    throw new Error("Incorrect current password.");
  }

  user.password = newPassword;
  await user.save();

  return {
    success: true,
    message: "Password changed successfully.",
  };
};