const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/BookingController");

// routing the so we can use url instead of calling the function directly
router.get("/bookings/:patientId", bookingController.getBookingsByPatientId);
router.get("/availability", bookingController.getAvailability);
router.post("/bookings", bookingController.postBooking);
router.delete("/bookings/:id", bookingController.deleteBooking);

module.exports = router;