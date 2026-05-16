const express = require("express");
const router = express.Router();
const { fetchPatientQueueInfo } = require("../Controllers/patientQueueController");


router.get("/:patientId", fetchPatientQueueInfo);

module.exports = router;