const express = require("express");
const router = express.Router();

const { checkUserLogin, registerUser, deleteUserAccount } = require("../Controllers/UserController");

router.get("/login/:userId", checkUserLogin);
router.post("/register", registerUser);
router.delete("/account", deleteUserAccount);

module.exports = router;
