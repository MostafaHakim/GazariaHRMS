const User = require("../models/User");
const Company = require("../models/Company");
const { signToken } = require("../middleware/authMiddleware");
const {
  recordLoginFailure,
  clearLoginFailures,
} = require("../middleware/loginRateLimit");

const validateCompanyAccess = async (companyAccess, defaultCompany) => {
  if (!Array.isArray(companyAccess) || companyAccess.length === 0) {
    return "Select at least one company for this user";
  }
  const ids = [...new Set(companyAccess.map(String))];
  if (ids.length !== companyAccess.length) return "Duplicate company access entries are not allowed";
  const count = await Company.countDocuments({ _id: { $in: ids }, isActive: true });
  if (count !== ids.length) return "One or more selected companies are invalid or inactive";
  if (defaultCompany && !ids.includes(String(defaultCompany))) {
    return "Default company must be included in company access";
  }
  return null;
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    // Express 5 এ বডি না থাকলে req.body undefined হয়
    const body = req.body || {};
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password are required",
      });
    }

    const user = await User.findOne({ username }).select("+password");
    const ok = user && user.isActive && (await user.comparePassword(password));

    if (!ok) {
      recordLoginFailure(req);
      return res
        .status(401)
        .json({ success: false, message: "Invalid username or password" });
    }

    clearLoginFailures(req);
    user.lastLoginAt = new Date();
    await user.save({ validateModifiedOnly: true });

    res.json({
      success: true,
      token: signToken(user),
      user: user.toSafeJSON(),
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/me
exports.me = async (req, res) => {
  res.json({ success: true, user: req.user.toSafeJSON() });
};

// PUT /api/auth/change-password
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current and new password are required",
      });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 8 characters",
      });
    }

    const user = await User.findById(req.user._id).select("+password");

    if (!(await user.comparePassword(currentPassword))) {
      return res
        .status(400)
        .json({ success: false, message: "Current password is incorrect" });
    }

    user.password = newPassword;
    await user.save();

    // নতুন পাসওয়ার্ডে নতুন টোকেন দিই যাতে এই সেশন চালু থাকে
    res.json({
      success: true,
      message: "Password changed successfully",
      token: signToken(user),
    });
  } catch (error) {
    next(error);
  }
};

/* -------------------- ADMIN: user management -------------------- */

// GET /api/auth/users
exports.listUsers = async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: 1 });
    res.json({ success: true, users: users.map((u) => u.toSafeJSON()) });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/users
exports.createUser = async (req, res, next) => {
  try {
    const { name, username, email, role, password, companyAccess, defaultCompany } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, username and password are required",
      });
    }
    if (String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }
    if (role && !User.ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    if (role !== 'ADMIN') {
      const accessError = await validateCompanyAccess(companyAccess, defaultCompany || companyAccess?.[0]);
      if (accessError) return res.status(400).json({ success: false, message: accessError });
    }
    const user = await User.create({ name, username, email, role, password, companyAccess: role === 'ADMIN' ? [] : companyAccess, defaultCompany: role === 'ADMIN' ? null : (defaultCompany || companyAccess[0]) });
    res.status(201).json({ success: true, user: user.toSafeJSON() });
  } catch (error) {
    next(error);
  }
};

// PUT /api/auth/users/:id   (name, email, role, isActive, password(optional reset))
exports.updateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select("+password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { name, email, role, isActive, password, companyAccess, defaultCompany } = req.body;
    const isSelf = String(user._id) === String(req.user._id);

    if (role !== undefined && !User.ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    // নিজেকে লক-আউট বা ডিমোট করা ঠেকাই
    if (isSelf && (isActive === false || (role && role !== "ADMIN"))) {
      return res.status(400).json({
        success: false,
        message: "You cannot disable or demote your own account",
      });
    }

    // শেষ অ্যাক্টিভ ADMIN কে সরানো যাবে না
    const losingAdmin =
      user.role === "ADMIN" &&
      ((role && role !== "ADMIN") || isActive === false);
    if (losingAdmin) {
      const otherAdmins = await User.countDocuments({
        role: "ADMIN",
        isActive: true,
        _id: { $ne: user._id },
      });
      if (otherAdmins === 0) {
        return res.status(400).json({
          success: false,
          message: "At least one active ADMIN is required",
        });
      }
    }

    const nextRole = role !== undefined ? role : user.role;
    const nextAccess = companyAccess !== undefined ? companyAccess : (user.companyAccess || []).map(String);
    const nextDefault = defaultCompany !== undefined ? defaultCompany : user.defaultCompany;
    if (nextRole !== 'ADMIN') {
      const accessError = await validateCompanyAccess(nextAccess, nextDefault);
      if (accessError) return res.status(400).json({ success: false, message: accessError });
    }
    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (role !== undefined) user.role = role;
    if (role === 'ADMIN') { user.companyAccess = []; user.defaultCompany = null; }
    else {
      if (companyAccess !== undefined) user.companyAccess = companyAccess;
      if (defaultCompany !== undefined) user.defaultCompany = defaultCompany;
    }
    if (isActive !== undefined) user.isActive = Boolean(isActive);

    if (password) {
      if (String(password).length < 8) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 8 characters",
        });
      }
      user.password = password;
    }

    await user.save();
    res.json({ success: true, user: user.toSafeJSON() });
  } catch (error) {
    next(error);
  }
};
