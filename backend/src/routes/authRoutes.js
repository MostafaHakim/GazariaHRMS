const express = require("express");
const router = express.Router();

const {
  login,
  me,
  changePassword,
  listUsers,
  createUser,
  updateUser,
} = require("../controllers/authController");
const { protect, authorize } = require("../middleware/authMiddleware");
const { loginRateLimit } = require("../middleware/loginRateLimit");

router.post("/login", loginRateLimit, login);

router.get("/me", protect, me);
router.put("/change-password", protect, changePassword);

router.get("/users", protect, authorize("ADMIN"), listUsers);
router.post("/users", protect, authorize("ADMIN"), createUser);
router.put("/users/:id", protect, authorize("ADMIN"), updateUser);

module.exports = router;
