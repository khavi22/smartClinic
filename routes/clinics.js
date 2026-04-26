const express = require("express");
const router = express.Router();
const { authMiddleware, requireAdmin } = require("../middlewares/auth");
const {
  getClinics,
  updateClinicHoursController,
  ensureClinicExistsController,
  getServiceTemplates,
  seedServiceTemplates,
  getServices,
  addService,
  updateService,
  deleteService
} = require("../controllers/ClinicsController");
router.get("/", getClinics); // GET /api/clinics
router.post("/update-hours", updateClinicHoursController); // POST /api/clinics/update-hours
router.post("/ensure-exists", ensureClinicExistsController); // POST /api/clinics/ensure-exists
// service templates
router.get("/templates", getServiceTemplates);
router.post("/templates/seed", authMiddleware, requireAdmin, seedServiceTemplates); // seeding protected

// services 
router.get("/services", authMiddleware, getServices);
router.post("/services", authMiddleware, addService);
router.put("/services/:serviceId", authMiddleware, updateService);
router.delete("/services/:serviceId", authMiddleware, deleteService);

module.exports = router;
