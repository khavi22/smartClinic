const express = require("express");
const router = express.Router();
const { getClinics } =require("../controllers/ClinicsController");

router.get("/",getClinics); // GET /api/clinics

module.exports = router;