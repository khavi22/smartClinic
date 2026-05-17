const express = require("express");
const router = express.Router();
const { 
    getClinics, 
    updateClinicHoursController, 
    ensureClinicExistsController, 
    getServiceTemplates, 
    seedServiceTemplates, 
    getServices, 
    addService, 
    updateService, 
    deleteService,
    updateClinicProfile
} = require("../Controllers/ClinicsController");
const { authMiddleware, requireAdmin } = require("../middlewares/auth");

router.get("/", getClinics); // GET /api/clinics
router.post("/update-hours", updateClinicHoursController); // POST /api/clinics/update-hours
router.post("/ensure-exists", ensureClinicExistsController); // POST /api/clinics/ensure-exists
// service templates
router.get("/templates", getServiceTemplates);
router.post("/templates/seed", authMiddleware, requireAdmin, seedServiceTemplates); // seeding protected

// clinic profile
router.put("/profile", authMiddleware, updateClinicProfile);  // PUT /api/clinics/profile

// services 
router.get("/services", getServices);  // Allow public access for booking UI
router.post("/services", authMiddleware, addService);
router.put("/services/:serviceId", authMiddleware, updateService);
router.delete("/services/:serviceId", authMiddleware, deleteService);

module.exports = router;
