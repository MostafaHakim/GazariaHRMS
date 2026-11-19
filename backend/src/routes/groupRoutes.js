const router=require("express").Router();
const c=require("../controllers/financeController");
const {authorize}=require("../middleware/authMiddleware");
router.get("/dashboard",authorize("ADMIN"),c.groupDashboard);
module.exports=router;
