const jwt = require("jsonwebtoken");
const User = require("../models/User");

const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET is missing or too short (min 16 chars) in .env");
  }
  return secret;
};

const signToken = (user) =>
  jwt.sign({ id: user._id.toString(), role: user.role }, getSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || "12h",
  });

// Authorization: Bearer <token>
const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Login required", code: "NO_TOKEN" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, getSecret());
    } catch (err) {
      return res.status(401).json({
        success: false,
        message:
          err.name === "TokenExpiredError"
            ? "Session expired. Please login again."
            : "Invalid token",
        code: err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "BAD_TOKEN",
      });
    }

    const user = await User.findById(decoded.id);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account not found or disabled",
        code: "USER_INACTIVE",
      });
    }

    // পাসওয়ার্ড বদলের আগে ইস্যু করা টোকেন বাতিল
    if (
      user.passwordChangedAt &&
      decoded.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)
    ) {
      return res.status(401).json({
        success: false,
        message: "Password changed. Please login again.",
        code: "PASSWORD_CHANGED",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
    }
    next();
  };

// নির্দিষ্ট রোল শুধু GET/HEAD/OPTIONS করতে পারবে (যেমন ACCOUNTS)
const readOnlyFor =
  (...roles) =>
  (req, res, next) => {
    const isRead = ["GET", "HEAD", "OPTIONS"].includes(req.method);
    if (!isRead && req.user && roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Your role has read-only access",
      });
    }
    next();
  };

module.exports = { protect, authorize, readOnlyFor, signToken, getSecret };
