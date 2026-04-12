const express = require("express");
const router = express.Router();
const appointmentsController = require("../Controllers/appointmentsController");

router.get("/appointments/:patientId", appointmentsController.getAppointmentsByPatientId);
router.get("/availability", appointmentsController.getAvailability);
router.post("/appointments", appointmentsController.postAppointment);
router.patch("/appointments/:id", appointmentsController.cancelAppointmentController);

module.exports = router;