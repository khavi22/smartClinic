const express = require("express");
const router = express.Router();
const { 
    setAvailability, 
    fetchAvailability,
    deleteAvailability 
} = require("../Controllers/SetAvailabilityController");

// Save availability
router.post("/set", setAvailability);

// Get availability
router.get("/:staffCode", fetchAvailability);

// Remove availability
router.delete("/remove", deleteAvailability);

// Get the clinic name for specific staff_
router.get("/staff/clinic/:uid", fetchClinicName);

module.exports = router;