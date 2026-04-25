const express = require("express");
const router = express.Router();
const { getClinics, updateClinicHoursController, ensureClinicExistsController } = require("../controllers/ClinicsController");

router.get("/", getClinics); // GET /api/clinics
router.post("/update-hours", updateClinicHoursController); // POST /api/clinics/update-hours
router.post("/ensure-exists", ensureClinicExistsController); // POST /api/clinics/ensure-exists

router.get("/templates", controller.getTemplates);
router.post("/templates/seed", controller.seedServiceTemplates);
router.get("/:clinicId", controller.getServices);
router.post("/:clinicId", controller.addService);
router.put("/:clinicId/:serviceId", controller.updateService);
router.delete("/:clinicId/:serviceId", controller.deleteService);
module.exports = router;
