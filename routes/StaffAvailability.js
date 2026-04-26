const express = require("express");
const router = express.Router();
const setAvailabilityController = require("../Controllers/SetAvailabilityController");

router.post("/set", setAvailabilityController.setAvailability);
router.get("/:staffCode", setAvailabilityController.fetchAvailability);
router.delete("/remove", setAvailabilityController.deleteAvailability);

module.exports = router;