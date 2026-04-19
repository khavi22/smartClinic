const express = require("express");
const router = express.Router();

const { checkUserLogin, registerUser } = require("../controllers/UserController");

router.get("/login/:userId", checkUserLogin);
router.post("/register", registerUser);

module.exports = router;