const express = require("express");
const router = express.Router();
const appointmentsController = require("../Controllers/appointmentsController");

router.get("/appointments/:patientId", appointmentsController.getAppointmentsByPatientId);
router.get("/availability", appointmentsController.getAvailability);
router.get("/availability/recommendations", appointmentsController.getRecommendations);
router.post("/appointments", appointmentsController.postAppointment);
router.patch("/appointments/:id", appointmentsController.cancelAppointmentController);
router.get("/smart-suggestion", appointmentsController.getSmartSuggestion);

module.exports = router;
