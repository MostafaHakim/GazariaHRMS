const router=require("express").Router();
const {updateUserAccess,listPunchEmployees}=require("../controllers/userAccessController");
const {authorize}=require("../middleware/authMiddleware");
router.get("/punch-employees",authorize("ADMIN"),listPunchEmployees);
router.patch("/:id/company-access",authorize("ADMIN"),updateUserAccess);
module.exports=router;
