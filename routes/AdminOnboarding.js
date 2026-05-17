const express = require("express");
const router = express.Router();
const {
    searchClinics,
    getClinicCode,
    sendAdminInvite,
    getInvitationStatus
} = require("../Controllers/AdminOnboardingController");

router.post("/search", searchClinics);
router.post("/clinic-code", getClinicCode);
router.post("/send-invite", sendAdminInvite);
router.get("/invitation-status/:clinicId", getInvitationStatus);

module.exports = router;