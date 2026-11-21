const errorMiddleware = (error, req, res, next) => {
  console.error(error);

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Duplicate value. This record already exists.",
      field: Object.keys(error.keyValue || {}),
      index: error.message?.match(/index: (\S+)/)?.[1], // কোন index এ আটকাচ্ছে (ডিবাগের জন্য)
    });
  }

  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Database validation failed",
      errors: Object.values(error.errors).map((item) => item.message),
    });
  }

  if (error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid ID or data format",
    });
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};

module.exports = errorMiddleware;
