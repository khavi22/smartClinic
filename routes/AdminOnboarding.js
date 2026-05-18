const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/auth");
const {
    searchClinics,
    getClinicCode,
    sendAdminInvite,
    getInvitationStatus
} = require("../Controllers/AdminOnboardingController");

// Support team emails from firestore.rules
const SUPPORT_TEAM_EMAILS = [
    'mahlatseclayton1@gmail.com',
    '2821750@students.wits.ac.za',
    '2829538@students.wits.ac.za',
    '2841214@students.wits.ca.za',
    '2913455@students.wits.ac.za',
    'gontsemaledu99@gmail.com',
    'Nnaki128@gmail.com'
];

/**
 * Middleware to verify support team access
 * Checks if user's email is in the support team list
 */
const requireSupportAccess = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    
    const userEmail = req.user.email;
    
    // Check if user email is in support team list
    if (!SUPPORT_TEAM_EMAILS.includes(userEmail)) {
        console.log(`Access denied for user: ${userEmail}. Not in support team.`);
        return res.status(403).json({ error: "Access denied. Support team access required." });
    }
    
    console.log(`Support team access granted to: ${userEmail}`);
    next();
};

// Apply token verification and support access check to all routes
router.use(verifyToken);
router.use(requireSupportAccess);

router.post("/search", searchClinics);
router.post("/clinic-code", getClinicCode);
router.post("/send-invite", sendAdminInvite);
router.get("/invitation-status/:clinicId", getInvitationStatus);

module.exports = router;