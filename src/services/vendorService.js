import Vendor from "../models/Vendor.js";
import User from "../models/User.js";
import VendorRating from "../models/VendorRating.js";

/**
 * =====================================================
 * Generate Vendor Code
 * Format : VEN00001
 * =====================================================
 */
const generateVendorCode = async () => {
  const lastVendor = await Vendor.findOne({
    vendorCode: { $exists: true, $ne: null },
  }).sort({
    createdAt: -1,
  });

  if (!lastVendor || !lastVendor.vendorCode) {
    return "VEN00001";
  }

  const lastNumber =
    parseInt(
      String(lastVendor.vendorCode).replace(/\D/g, "")
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
  // Deduplication check
  if (vendorData.email) {
    const existingEmail = await Vendor.findOne({
      email: vendorData.email.trim().toLowerCase(),
      isDeleted: false,
    });
    if (existingEmail) {
      const error = new Error("A vendor with this email address already exists.");
      error.statusCode = 409;
      throw error;
    }
  }

  if (vendorData.vendorName) {
    const existingName = await Vendor.findOne({
      vendorName: { $regex: `^${vendorData.vendorName.trim()}$`, $options: "i" },
      isDeleted: false,
    });
    if (existingName) {
      const error = new Error("A vendor with this name already exists.");
      error.statusCode = 409;
      throw error;
    }
  }

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
 * Helper: Attach Latest Ratings to Vendors
 * =====================================================
 */
const attachRatingsToVendors = async (vendors) => {
  if (!vendors || vendors.length === 0) return [];

  const vendorIds = vendors.map((v) => v._id);

  // Find all active ratings for these vendors, sorted newest first
  const ratings = await VendorRating.find({
    vendor: { $in: vendorIds },
    isDeleted: false,
  })
    .sort({ createdAt: -1 })
    .select(
      "vendor finalOverallScore systemOverallScore ratingCategory status createdAt"
    )
    .lean();

  // Map latest rating per vendor, prioritizing Approved/Locked over Draft/Under Review
  const ratingMap = new Map();
  for (const r of ratings) {
    const vId = r.vendor.toString();
    if (!ratingMap.has(vId)) {
      ratingMap.set(vId, r);
    } else {
      const existing = ratingMap.get(vId);
      const isCurrentOfficial = ["Approved", "Locked"].includes(r.status);
      const isExistingOfficial = ["Approved", "Locked"].includes(
        existing.status
      );
      if (isCurrentOfficial && !isExistingOfficial) {
        ratingMap.set(vId, r);
      }
    }
  }

  return vendors.map((v) => {
    const doc = v.toObject ? v.toObject() : { ...v };
    const latestRating = ratingMap.get(v._id.toString());

    // Determine overall score (0 - 100)
    let overallScore = null;
    if (
      latestRating?.finalOverallScore !== null &&
      latestRating?.finalOverallScore !== undefined
    ) {
      overallScore = latestRating.finalOverallScore;
    } else if (
      latestRating?.systemOverallScore !== null &&
      latestRating?.systemOverallScore !== undefined
    ) {
      overallScore = latestRating.systemOverallScore;
    } else if (
      doc.performance?.overallRating !== null &&
      doc.performance?.overallRating !== undefined &&
      doc.performance.overallRating > 0
    ) {
      overallScore = doc.performance.overallRating;
    }

    // Convert score (0 - 100) to 5-star rating (0.0 to 5.0)
    const rating5 =
      overallScore !== null
        ? Number((overallScore / 20).toFixed(1))
        : null;

    const ratingCategory =
      latestRating?.ratingCategory ||
      doc.performance?.ratingCategory ||
      null;

    const ratingStatus = latestRating?.status || null;

    return {
      ...doc,
      overallRating: rating5,
      overallScore:
        overallScore !== null ? Number(Number(overallScore).toFixed(1)) : null,
      ratingCategory,
      ratingStatus,
      rating: rating5,
    };
  });
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

  const enrichedVendors = await attachRatingsToVendors(vendors);

  return {
    vendors: enrichedVendors,
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
  const vendor = await Vendor.findById(id);
  if (!vendor) return null;
  const [enriched] = await attachRatingsToVendors([vendor]);
  return enriched;
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