const firebaseService = require("../services/firebaseService");
const emailService = require("../services/emailService");

exports.inviteStaff = async (req, res) => {
    try {
        const { email, clinicId } = req.body;
        const adminUid = req.user.uid;

        if (!email || !clinicId) {
            return res.status(400).json({ success: false, message: "Email and Clinic ID are required." });
        }

        await firebaseService.inviteStaffByEmail(adminUid, clinicId, email);

        const clinicName = await firebaseService.getClinicNameById(clinicId);
        const adminProfile = await firebaseService.getUserProfileById(adminUid);
        const adminName = adminProfile?.fullName || "A Clinic Administrator";
        const adminEmail = adminProfile?.email || req.user.email;
        
        await emailService.sendStaffInvitation(email, clinicName, adminName, adminEmail);

        res.json({ success: true, message: "Staff member invited successfully." });
    } catch (error) {
        console.error("Invite staff error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getPendingStaff = async (req, res) => {
    try {
        const { clinicId } = req.query;
        if (!clinicId) {
            return res.status(400).json({ success: false, message: "Clinic ID is required." });
        }

        const pendingStaff = await firebaseService.getPendingStaffByClinic(clinicId);
        res.json({ success: true, staff: pendingStaff });
    } catch (error) {
        console.error("Get pending staff error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.processStaffApproval = async (req, res) => {
    try {
        const { staffUid, status, clinicId } = req.body; // status: 'approved' or 'rejected'

        if (!staffUid || !status || !clinicId) {
            return res.status(400).json({ success: false, message: "Missing required fields." });
        }

        if (!["approved", "rejected"].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status." });
        }

        await firebaseService.updateStaffApprovalStatus(staffUid, status);

        const staffProfile = await firebaseService.getUserProfileById(staffUid);
        if (!staffProfile || !staffProfile.email) {
            return res.status(404).json({ success: false, message: "Staff profile not found." });
        }

        const clinicName = await firebaseService.getClinicNameById(clinicId);
        const adminProfile = await firebaseService.getUserProfileById(req.user.uid);
        const adminName = adminProfile?.fullName || "The Clinic Administrator";
        const adminEmail = adminProfile?.email || req.user.email;

        if (status === "approved") {
            await emailService.sendStaffApproval(staffProfile.email, clinicName, adminName, adminEmail);
        } else {
            await emailService.sendStaffRejection(staffProfile.email, clinicName, adminName, adminEmail);
        }

        res.json({ success: true, message: `Staff member ${status} successfully.` });
    } catch (error) {
        console.error("Process staff approval error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
