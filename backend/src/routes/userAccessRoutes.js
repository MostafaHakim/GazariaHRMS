const router=require("express").Router();
const {updateUserAccess}=require("../controllers/userAccessController");
const {authorize}=require("../middleware/authMiddleware");
router.patch("/:id/company-access",authorize("ADMIN"),updateUserAccess);
module.exports=router;
