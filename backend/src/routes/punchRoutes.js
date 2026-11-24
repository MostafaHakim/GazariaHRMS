const express = require("express");
const router = express.Router();
const { authorize } = require("../middleware/authMiddleware");
const { listBoard, punchIn, punchOut } = require("../controllers/punchController");

// শুধু SECURITY রোল। কোন কর্মীকে পাঞ্চ দেওয়া যাবে তা ইউজারের punchEmployees তালিকা থেকে সার্ভারে যাচাই হয়।
// এডিট/ডিলিটের কোনো রুট নেই — একবার পাঞ্চ হলে সিকিউরিটি বদলাতে পারে না।
router.use(authorize("SECURITY"));

router.get("/employees", listBoard);
router.post("/employees/:id/in", punchIn);
router.post("/employees/:id/out", punchOut);

module.exports = router;
