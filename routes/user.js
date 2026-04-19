const express = require("express");
const router = express.Router();

const { checkUserLogin, registerUser, deleteUserAccount } = require("../controllers/UserController");

router.get("/login/:userId", checkUserLogin);
router.post("/register", registerUser);
router.delete("/account", deleteUserAccount);

module.exports = router;
