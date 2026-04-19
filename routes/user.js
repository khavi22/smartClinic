const express = require("express");
const router = express.Router();

const { checkUserLogin, registerUser, deleteUserAccount } = require("../Controllers/UserController");

router.get("/login/:userId", checkUserLogin);
router.post("/register", registerUser);
router.post("/signup", registerUser); // Alias for compatibility with mate's frontend
router.delete("/account", deleteUserAccount);

module.exports = router;
