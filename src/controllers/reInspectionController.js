import {
  createReInspection,
  getReInspections,
  getReInspectionById,
  updateReInspection,
  completeReInspection,
  getReInspectionHistory,
  getEligibleReplacementReceipts,
} from "../services/reInspectionService.js";


// =========================================================
// CREATE
// =========================================================

export const create = async (req, res) => {

  try {

    const userId =
      req.user?._id ||
      req.user?.id;

    const reInspection =
      await createReInspection(
        req.body,
        userId
      );

    return res.status(201).json({
      success: true,
      message:
        "Re-inspection created successfully.",
      data: reInspection,
    });

  } catch (error) {

    console.error(
      "Create Re-Inspection Error:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to create re-inspection.",
    });

  }

};


// =========================================================
// GET ALL
// =========================================================

export const getAll = async (req, res) => {

  try {

    const {
      status,
      reinspectionType,
      originalInspection,
    } = req.query;


    const reInspections =
      await getReInspections({
        status,
        reinspectionType,
        originalInspection,
      });


    return res.status(200).json({
      success: true,
      data: reInspections,
    });

  } catch (error) {

    console.error(
      "Get Re-Inspections Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch re-inspections.",
    });

  }

};


// =========================================================
// GET ONE
// =========================================================

export const getOne = async (req, res) => {

  try {

    const reInspection =
      await getReInspectionById(
        req.params.id
      );


    return res.status(200).json({
      success: true,
      data: reInspection,
    });

  } catch (error) {

    console.error(
      "Get Re-Inspection Error:",
      error
    );

    return res.status(404).json({
      success: false,
      message:
        error.message ||
        "Re-inspection not found.",
    });

  }

};


// =========================================================
// UPDATE
// =========================================================

export const update = async (req, res) => {

  try {

    const reInspection =
      await updateReInspection(
        req.params.id,
        req.body
      );


    return res.status(200).json({
      success: true,
      message:
        "Re-inspection updated successfully.",
      data: reInspection,
    });

  } catch (error) {

    console.error(
      "Update Re-Inspection Error:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to update re-inspection.",
    });

  }

};

// =========================================================
// COMPLETE / FINAL DECISION
// =========================================================

export const complete = async (
  req,
  res
) => {

  try {

    const userId =
      req.user?._id ||
      req.user?.id;


    const reInspection =
      await completeReInspection(
        req.params.id,
        req.body,
        userId
      );


    return res.status(200).json({

      success: true,

      message:
        "Re-inspection completed successfully.",

      data:
        reInspection,

    });

  } catch (error) {

    console.error(
      "Complete Re-Inspection Error:",
      error
    );


    return res.status(400).json({

      success: false,

      message:
        error.message ||
        "Failed to complete re-inspection.",

    });

  }

};

// =========================================================
// GET RE-INSPECTION HISTORY
// =========================================================

export const getHistory = async (
  req,
  res
) => {

  try {

    const history =
      await getReInspectionHistory(
        req.params.originalInspectionId
      );

    return res.status(200).json({
      success: true,
      data: history,
    });

  } catch (error) {

    console.error(
      "Get Re-Inspection History Error:",
      error
    );

    return res.status(400).json({
      success: false,
      message:
        error.message ||
        "Failed to fetch re-inspection history.",
    });

  }

};

export const getEligibleReplacementMaterials = async (req, res) => {
  try {
    const receipts = await getEligibleReplacementReceipts(
      req.params.originalInspectionId
    );

    return res.status(200).json({
      success: true,
      data: receipts,
    });
  } catch (error) {
    console.error("Get Replacement Re-Inspection Materials Error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to fetch replacement materials.",
    });
  }
};
