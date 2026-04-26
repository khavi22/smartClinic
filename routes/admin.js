const express = require("express");
const router = express.Router();
const adminController = require("../Controllers/AdminController");
const { verifyToken, requireRole } = require("../middlewares/auth");

// All admin routes require admin role
router.use(verifyToken, requireRole("admin"));

router.post("/invite-staff", adminController.inviteStaff);
router.get("/pending-staff", adminController.getPendingStaff);
router.post("/process-staff", adminController.processStaffApproval);

module.exports = router;
