const express = require("express");
const router = express.Router();

const { checkUserLogin, createPatientProfileController } = require("../controllers/UserController");

router.get("/login/:userId", checkUserLogin);
router.post("/signup", createPatientProfileController);

module.exports = router;