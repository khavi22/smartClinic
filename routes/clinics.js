const express = require("express");
const router = express.Router();
const { getClinics } = require("../Controllers/ClinicsController");

router.get("/", getClinics); // GET /api/clinics

module.exports = router;