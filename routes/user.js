const express = require("express");
const router = express.Router();

const { checkUserLogin, createPatientProfile, createAdminProfile } = require("../controllers/UserController");

router.get("/login/:userId", checkUserLogin);
router.post("/signup", createPatientProfile);
router.post("/admin", createAdminProfile);

module.exports = router;