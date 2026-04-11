const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/bookingController");

router.get("/bookings/:patientId", bookingController.getBookingsByPatientId);

module.exports = router;