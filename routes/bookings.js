const express = require("express");
const router = express.Router();
const appointmentsController = require("../controllers/appointmentsController");

router.get("/appointments/:patientId", appointmentsController.getAppointmentsByPatientId);
router.get("/availability", appointmentsController.getAvailability);
router.post("/appointments", appointmentsController.postAppointment);

module.exports = router;