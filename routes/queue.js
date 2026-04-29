const express = require("express");
const router = express.Router();

const queueController = require("../Controllers/queueController");
const { verifyToken, requireRole } = require("../middlewares/auth");

// All queue routes require staff role (or admin if you want)
router.use(verifyToken, requireRole("staff"));

// Get queue (this will ALSO add today's appointments)
router.get("/:clinicId", queueController.getQueue);

module.exports = router;