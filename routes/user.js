const express = require("express");
const router = express.Router();

const { checkUserLogin, createUserProfile, deleteUserAccount } = require("../controllers/UserController");

router.get("/login/:userId", checkUserLogin);
router.post("/signup", createUserProfile);
router.delete("/account", deleteUserAccount);

module.exports = router;
