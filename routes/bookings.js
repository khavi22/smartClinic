const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/BookingController");

// routing the so we can use url instead of calling the function directly
router.get("/bookings/:patientId", bookingController.getBookingsByPatientId);
router.get("/availability", bookingController.getAvailability);
router.post("/bookings", bookingController.postBooking);

module.exports = router;