export const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  let statusCode =
    err.statusCode ||
    (res.statusCode && res.statusCode !== 200
      ? res.statusCode
      : 500);

  let message = err.message || "Internal Server Error";

  // Clean MongoDB duplicate key error (code 11000)
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || "Field";
    const value = err.keyValue ? err.keyValue[field] : "";
    message = value
      ? `${field} '${value}' already exists. Please use a unique value.`
      : `${field} already exists. Please use a unique value.`;
  }

  res.status(statusCode).json({
    success: false,
    message,
  });
};
