const express = require("express");
const router = express.Router();
const appointmentsController = require("../Controllers/appointmentsController");

router.get("/appointments/:patientId", appointmentsController.getAppointmentsByPatientId);
router.get("/availability", appointmentsController.getAvailability);
router.post("/appointments", appointmentsController.postAppointment);
router.delete("/appointments/:id", appointmentsController.deleteAppointment);

module.exports = router;