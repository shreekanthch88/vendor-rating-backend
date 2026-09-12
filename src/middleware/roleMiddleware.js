/**
 * Role-based authorization middleware
 * Usage:
 * authorize("admin")
 * authorize("admin", "purchase_manager")
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    // User should already be attached by protect middleware
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action.",
      });
    }

    next();
  };
};