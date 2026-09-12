import * as vendorService from "../services/vendorService.js";

/**
 * =====================================================
 * Create Vendor
 * =====================================================
 */
export const createVendor = async (req, res) => {
  try {
    const vendor = await vendorService.createVendor(
      req.body,
      req.user.id
    );

    res.status(201).json({
      success: true,
      message: "Vendor created successfully.",
      vendor,
    });
  } catch (error) {
    console.error("Create Vendor Error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * =====================================================
 * Get All Vendors
 * =====================================================
 */
export const getAllVendors = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
    } = req.query;

    const data = await vendorService.getAllVendors(
      page,
      limit,
      search,
      status
    );

    res.status(200).json({
      success: true,
      ...data,
    });
  } catch (error) {
    console.error("Get Vendors Error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * =====================================================
 * Get Vendor By ID
 * =====================================================
 */
export const getVendorById = async (req, res) => {
  try {
    const vendor =
      await vendorService.getVendorById(
        req.params.id
      );

    if (!vendor || vendor.isDeleted) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found.",
      });
    }

    res.status(200).json({
      success: true,
      vendor,
    });
  } catch (error) {
    console.error("Get Vendor Error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * =====================================================
 * Update Vendor
 * =====================================================
 */
export const updateVendor = async (req, res) => {
  try {
    const updateData = { ...req.body };

    // Only SUPER_ADMIN and ADMIN are allowed to change vendor status
    if (updateData.status !== undefined) {
      const isAllowedRole = ["SUPER_ADMIN", "ADMIN"].includes(req.user?.role);
      if (!isAllowedRole) {
        delete updateData.status;
      }
    }

    const vendor =
      await vendorService.updateVendor(
        req.params.id,
        updateData,
        req.user.id
      );

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Vendor updated successfully.",
      vendor,
    });
  } catch (error) {
    console.error("Update Vendor Error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * =====================================================
 * Update Vendor Status
 * =====================================================
 */
export const updateVendorStatus = async (
  req,
  res
) => {
  try {
    const vendor =
      await vendorService.updateVendorStatus(
        req.params.id,
        req.body.status,
        req.user.id
      );

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found.",
      });
    }

    res.status(200).json({
      success: true,
      message:
        "Vendor status updated successfully.",
      vendor,
    });
  } catch (error) {
    console.error("Update Status Error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * =====================================================
 * Delete Vendor
 * =====================================================
 */
export const deleteVendor = async (
  req,
  res
) => {
  try {
    const vendor =
      await vendorService.deleteVendor(
        req.params.id,
        req.user.id
      );

    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found.",
      });
    }

    res.status(200).json({
      success: true,
      message:
        "Vendor deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Vendor Error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * =====================================================
 * Vendor Dashboard
 * =====================================================
 */
export const getVendorDashboard =
  async (req, res) => {
    try {
      const dashboard =
        await vendorService.getVendorDashboard();

      res.status(200).json({
        success: true,
        dashboard,
      });
    } catch (error) {
      console.error("Dashboard Error:", error);

      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

/**
 * =====================================================
 * Create Vendor User
 * =====================================================
 */
export const createVendorUser = async (
  req,
  res
) => {
  try {
    const user =
      await vendorService.createVendorUser(
        req.params.vendorId,
        req.body
      );

    res.status(201).json({
      success: true,
      message:
        "Vendor User created successfully.",
      user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * =====================================================
 * Get Vendor Users
 * =====================================================
 */
export const getVendorUsers = async (
  req,
  res
) => {
  try {
    const users =
      await vendorService.getVendorUsers(
        req.params.vendorId
      );

    res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * =====================================================
 * Get Vendor User
 * =====================================================
 */
export const getVendorUserById =
  async (req, res) => {
    try {
      const user =
        await vendorService.getVendorUserById(
          req.params.vendorId,
          req.params.userId
        );

      res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

/**
 * =====================================================
 * Update Vendor User
 * =====================================================
 */
export const updateVendorUser =
  async (req, res) => {
    try {
      const user =
        await vendorService.updateVendorUser(
          req.params.vendorId,
          req.params.userId,
          req.body
        );

      res.status(200).json({
        success: true,
        message:
          "Vendor User updated successfully.",
        user,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

/**
 * =====================================================
 * Reset Vendor Password
 * =====================================================
 */
export const resetVendorUserPassword =
  async (req, res) => {
    try {
      const result =
        await vendorService.resetVendorUserPassword(
          req.params.vendorId,
          req.params.userId,
          req.body.password
        );

      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

/**
 * =====================================================
 * Change Vendor User Status
 * =====================================================
 */
export const changeVendorUserStatus =
  async (req, res) => {
    try {
      const user =
        await vendorService.changeVendorUserStatus(
          req.params.vendorId,
          req.params.userId,
          req.body.status
        );

      res.status(200).json({
        success: true,
        message:
          "Vendor User status updated.",
        user,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

/**
 * =====================================================
 * Delete Vendor User
 * =====================================================
 */
export const deleteVendorUser =
  async (req, res) => {
    try {
      const user =
        await vendorService.deleteVendorUser(
          req.params.vendorId,
          req.params.userId
        );

      res.status(200).json({
        success: true,
        message:
          "Vendor User deleted successfully.",
        user,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };