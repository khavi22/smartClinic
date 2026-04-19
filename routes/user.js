const express = require("express");
const router = express.Router();

const { checkUserLogin, createPatientProfileController, createAdminProfile } = require("../controllers/UserController");

router.get("/login/:userId", checkUserLogin);
router.post("/signup", createPatientProfileController);
router.post("/admin", createAdminProfile);

module.exports = router;