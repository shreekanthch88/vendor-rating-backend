import User from "../models/User.js";

/**
 * Get all users with Search, Filter, Pagination & Sorting
 */
export const getAllUsers = async (query = {}) => {
  const {
    search = "",
    role = "",
    status = "",
    page = 1,
    limit = 10,
    sort = "createdAt",
    order = "desc",
  } = query;

  // Build filter
  const filter = {};

  // Search by name or email
  if (search) {
    filter.$or = [
      {
        name: {
          $regex: search,
          $options: "i",
        },
      },
      {
        email: {
          $regex: search,
          $options: "i",
        },
      },
    ];
  }

  // Role Filter
  if (role) {
    filter.role = role;
  }

  // Status Filter
  if (status) {
    filter.status = status;
  }

  const pageNumber = Number(page);
  const limitNumber = Number(limit);
  const skip = (pageNumber - 1) * limitNumber;

  // Count total matching records
  const totalRecords = await User.countDocuments(filter);

  // Fetch users
  const users = await User.find(filter)
    .select("-password")
    .sort({
      [sort]: order === "asc" ? 1 : -1,
    })
    .skip(skip)
    .limit(limitNumber);

  return {
    users,
    pagination: {
      page: pageNumber,
      limit: limitNumber,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limitNumber),
    },
  };
};

/**
 * Get user by ID
 */
export const getUserById = async (id) => {
  return await User.findById(id).select("-password");
};

/**
 * Create new user
 */
export const createUser = async (userData) => {
  const existingUser = await User.findOne({
    email: userData.email,
  });

  if (existingUser) {
    throw new Error("Email already exists.");
  }

  const user = new User(userData);

  return await user.save();
};

/**
 * Update user
 */
export const updateUser = async (id, userData) => {
  // Prevent duplicate email
  if (userData.email) {
    const existingUser = await User.findOne({
      email: userData.email,
      _id: { $ne: id },
    });

    if (existingUser) {
      throw new Error("Email already exists.");
    }
  }

  return await User.findByIdAndUpdate(id, userData, {
    new: true,
    runValidators: true,
  }).select("-password");
};

/**
 * Update user status
 */
export const updateUserStatus = async (id, status) => {
  return await User.findByIdAndUpdate(
    id,
    { status },
    {
      new: true,
      runValidators: true,
    }
  ).select("-password");
};

/**
 * Delete user
 * (Hard delete for development)
 * Later we will convert this to Soft Delete.
 */
export const deleteUser = async (id) => {
  return await User.findByIdAndDelete(id);
};

/**
 * Reset User Password (Admin)
 */
export const resetUserPassword = async (id, newPassword) => {
  if (!newPassword || newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const user = await User.findById(id);
  if (!user) {
    throw new Error("User not found.");
  }

  user.password = newPassword;
  await user.save();

  return {
    success: true,
    message: "Password reset successfully.",
  };
};