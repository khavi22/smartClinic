const express = require("express");
const router = express.Router();
const { getClinics, updateClinicHoursController, ensureClinicExistsController } = require("../controllers/ClinicsController");

router.get("/", getClinics); // GET /api/clinics
router.post("/update-hours", updateClinicHoursController); // POST /api/clinics/update-hours
router.post("/ensure-exists", ensureClinicExistsController); // POST /api/clinics/ensure-exists

module.exports = router;
