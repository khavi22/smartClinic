const firebaseService = require("../services/firebaseService");
const emailService = require("../services/emailService");

exports.getWaitTimeReport = async (req, res) => {
    try {
        const { clinicId, startDate, endDate } = req.query;

        if (!clinicId || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "clinicId, startDate, and endDate query parameters are required"
            });
        }

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
            return res.status(400).json({
                success: false,
                message: "Dates must be in YYYY-MM-DD format"
            });
        }

        if (startDate > endDate) {
            return res.status(400).json({
                success: false,
                message: "startDate must be on or before endDate"
            });
        }

        const report = await firebaseService.getWaitTimeReport(clinicId, startDate, endDate);

        return res.status(200).json({ success: true, report });
    } catch (error) {
        console.error("Wait time report error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to generate wait time report",
            error: error.message
        });
    }
};

exports.getNoShowReport = async (req, res) => {
    try {
        const { clinicId, startDate, endDate } = req.query;

        if (!clinicId || !startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "clinicId, startDate, and endDate query parameters are required"
            });
        }

        // Basic date format validation (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
            return res.status(400).json({
                success: false,
                message: "Dates must be in YYYY-MM-DD format"
            });
        }

        if (startDate > endDate) {
            return res.status(400).json({
                success: false,
                message: "startDate must be on or before endDate"
            });
        }

        const report = await firebaseService.getNoShowReport(clinicId, startDate, endDate);

        return res.status(200).json({ success: true, report });
    } catch (error) {
        console.error("No-show report error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to generate no-show report",
            error: error.message
        });
    }
};

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

exports.getActiveStaff = async (req, res) => {
    try {
        const { clinicId } = req.query;
        if (!clinicId) return res.status(400).json({ success: false, message: "Clinic ID is required." });

        const activeStaff = await firebaseService.getActiveStaffByClinic(clinicId);
        res.json({ success: true, staff: activeStaff });
    } catch (error) {
        console.error("Get active staff error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.removeStaff = async (req, res) => {
    try {
        const { staffUid } = req.body;
        const adminUid = req.user.uid;
        
        if (!staffUid) {
            return res.status(400).json({ success: false, message: "Missing staffUid" });
        }

        // Security Check: Ensure the staff member belongs to this admin's clinic
        const staffProfile = await firebaseService.getUserProfileById(staffUid);
        const adminProfile = await firebaseService.getUserProfileById(adminUid);

        if (!staffProfile || staffProfile.role !== "staff") {
            return res.status(404).json({ success: false, message: "Staff member not found." });
        }

        if (staffProfile.clinicId !== adminProfile.clinicId) {
            return res.status(403).json({ success: false, message: "You do not have permission to remove this staff member." });
        }

        // Perform full deletion (Auth, Profile, and Invite)
        await firebaseService.deleteUserAccount(staffUid);
        
        res.json({ success: true, message: "Staff account and invitation deleted successfully." });
    } catch (error) {
        console.error("Remove staff error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};