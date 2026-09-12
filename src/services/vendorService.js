import Vendor from "../models/Vendor.js";
import User from "../models/User.js";

/**
 * =====================================================
 * Generate Vendor Code
 * Format : VEN00001
 * =====================================================
 */
const generateVendorCode = async () => {
  const lastVendor = await Vendor.findOne().sort({
    createdAt: -1,
  });

  if (!lastVendor) {
    return "VEN00001";
  }

  const lastNumber =
    parseInt(
      lastVendor.vendorCode.replace("VEN", "")
    ) || 0;

  const nextNumber = lastNumber + 1;

  return `VEN${nextNumber
    .toString()
    .padStart(5, "0")}`;
};

/**
 * =====================================================
 * Create Vendor
 * =====================================================
 */
export const createVendor = async (
  vendorData,
  userId
) => {
  const vendorCode =
    await generateVendorCode();

  const vendor = await Vendor.create({
    ...vendorData,
    vendorCode,
    createdBy: userId,
  });

  return vendor;
};

/**
 * =====================================================
 * Get All Vendors
 * =====================================================
 */
export const getAllVendors = async (
  page = 1,
  limit = 10,
  search = "",
  status = ""
) => {
  const query = {
    isDeleted: false,
  };

  if (search) {
    query.$or = [
      {
        vendorName: {
          $regex: search,
          $options: "i",
        },
      },
      {
        vendorCode: {
          $regex: search,
          $options: "i",
        },
      },
      {
        gstNumber: {
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

  if (status) {
    query.status = status;
  }

  const total =
    await Vendor.countDocuments(query);

  const vendors = await Vendor.find(query)
    .sort({
      createdAt: -1,
    })
    .skip((page - 1) * limit)
    .limit(Number(limit));

  return {
    vendors,
    total,
    page: Number(page),
    pages: Math.ceil(
      total / Number(limit)
    ),
  };
};

/**
 * =====================================================
 * Get Vendor By ID
 * =====================================================
 */
export const getVendorById = async (
  id
) => {
  return await Vendor.findById(id);
};

/**
 * =====================================================
 * Update Vendor
 * =====================================================
 */
export const updateVendor = async (
  id,
  data,
  userId
) => {
  return await Vendor.findByIdAndUpdate(
    id,
    {
      ...data,
      updatedBy: userId,
    },
    {
      new: true,
      runValidators: true,
    }
  );
};

/**
 * =====================================================
 * Change Vendor Status
 * =====================================================
 */
export const updateVendorStatus =
  async (
    id,
    status,
    userId
  ) => {
    return await Vendor.findByIdAndUpdate(
      id,
      {
        status,
        updatedBy: userId,
      },
      {
        new: true,
      }
    );
  };

/**
 * =====================================================
 * Soft Delete Vendor
 * =====================================================
 */
export const deleteVendor = async (
  id,
  userId
) => {
  return await Vendor.findByIdAndUpdate(
    id,
    {
      isDeleted: true,
      updatedBy: userId,
    },
    {
      new: true,
    }
  );
};

/**
 * =====================================================
 * Vendor Dashboard
 * =====================================================
 */
export const getVendorDashboard =
  async () => {
    const totalVendors =
      await Vendor.countDocuments({
        isDeleted: false,
      });

    const activeVendors =
      await Vendor.countDocuments({
        status: "Active",
        isDeleted: false,
      });

    const inactiveVendors =
      await Vendor.countDocuments({
        status: "Inactive",
        isDeleted: false,
      });

    const blacklistedVendors =
      await Vendor.countDocuments({
        status: "Blacklisted",
        isDeleted: false,
      });

    const pendingVendors =
      await Vendor.countDocuments({
        status: "Pending",
        isDeleted: false,
      });

    return {
      totalVendors,
      activeVendors,
      inactiveVendors,
      blacklistedVendors,
      pendingVendors,
    };
  };

  /**
 * =====================================================
 * Create Vendor User
 * =====================================================
 */
export const createVendorUser = async (
  vendorId,
  userData
) => {
  const vendor = await Vendor.findById(vendorId);

  if (!vendor || vendor.isDeleted) {
    throw new Error("Vendor not found.");
  }

  const existingUser = await User.findOne({
    email: userData.email.toLowerCase(),
  });

  if (existingUser) {
    throw new Error("Email already exists.");
  }

  const vendorUser = await User.create({
    name: userData.name,
    email: userData.email.toLowerCase(),
    password: userData.password,
    phone: userData.phone,
    designation: userData.designation,
    department: "Vendor",
    vendor: vendor._id,
    role: "VENDOR",
    isPrimaryContact:
      userData.isPrimaryContact || false,
    status: "ACTIVE",
  });

  return await User.findById(
    vendorUser._id
  ).select("-password");
};

/**
 * =====================================================
 * Get Vendor Users
 * =====================================================
 */
export const getVendorUsers = async (
  vendorId
) => {
  const vendor = await Vendor.findById(
    vendorId
  );

  if (!vendor || vendor.isDeleted) {
    throw new Error("Vendor not found.");
  }

  return await User.find({
    vendor: vendorId,
    role: "VENDOR",
  })
    .select("-password")
    .sort({
      createdAt: -1,
    });
};

/**
 * =====================================================
 * Get Vendor User By Id
 * =====================================================
 */
export const getVendorUserById = async (
  vendorId,
  userId
) => {
  const user = await User.findOne({
    _id: userId,
    vendor: vendorId,
    role: "VENDOR",
  }).select("-password");

  if (!user) {
    throw new Error(
      "Vendor User not found."
    );
  }

  return user;
};

/**
 * =====================================================
 * Update Vendor User
 * =====================================================
 */
export const updateVendorUser = async (
  vendorId,
  userId,
  data
) => {
  delete data.password;
  delete data.role;
  delete data.vendor;

  const user =
    await User.findOneAndUpdate(
      {
        _id: userId,
        vendor: vendorId,
        role: "VENDOR",
      },
      {
        ...data,
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("-password");

  if (!user) {
    throw new Error(
      "Vendor User not found."
    );
  }

  return user;
};

/**
 * =====================================================
 * Reset Vendor User Password
 * =====================================================
 */
export const resetVendorUserPassword =
  async (
    vendorId,
    userId,
    password
  ) => {
    const user =
      await User.findOne({
        _id: userId,
        vendor: vendorId,
        role: "VENDOR",
      });

    if (!user) {
      throw new Error(
        "Vendor User not found."
      );
    }

    user.password = password;

    await user.save();

    return {
      success: true,
      message:
        "Password reset successfully.",
    };
  };

/**
 * =====================================================
 * Change Vendor User Status
 * =====================================================
 */
export const changeVendorUserStatus =
  async (
    vendorId,
    userId,
    status
  ) => {
    if (
      !["ACTIVE", "INACTIVE"].includes(
        status
      )
    ) {
      throw new Error(
        "Invalid status."
      );
    }

    const user =
      await User.findOneAndUpdate(
        {
          _id: userId,
          vendor: vendorId,
          role: "VENDOR",
        },
        {
          status,
        },
        {
          new: true,
        }
      ).select("-password");

    if (!user) {
      throw new Error(
        "Vendor User not found."
      );
    }

    return user;
  };

/**
 * =====================================================
 * Delete Vendor User (Soft Delete)
 * =====================================================
 */
export const deleteVendorUser =
  async (
    vendorId,
    userId
  ) => {
    const user =
      await User.findOneAndUpdate(
        {
          _id: userId,
          vendor: vendorId,
          role: "VENDOR",
        },
        {
          status: "INACTIVE",
        },
        {
          new: true,
        }
      ).select("-password");

    if (!user) {
      throw new Error(
        "Vendor User not found."
      );
    }

    return user;
  };