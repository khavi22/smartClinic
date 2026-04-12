const express = require("express");
const router = express.Router();

const { checkUserLogin, createPatientProfile } = require("../controllers/UserController");

router.get("/login/:userId", checkUserLogin);
router.post("/signup", createPatientProfile);

module.exports = router;