const { getUserProfileById, createPatientProfile } = require("../services/firebaseService");
const firebaseService = require('../services/firebaseService');

exports.checkUserLogin = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ error: "Missing userId" });
        }

        const user = await getUserProfileById(userId);

        if (user) {
            const redirectUrl = user.role === "admin" ? "/adminDashboard.html" : "/dashboard.html";
            return res.json({
                success: true,
                exists: true,
                redirect: redirectUrl
            });
        }

        return res.json({
            success: true,
            exists: false,
            redirect: "/signUp.html"
        });
    } catch (error) {
        console.error("User login check failed:", error);
        return res.status(500).json({
            error: "Failed to check user login"
        });
    }
};

exports.createPatientProfileController = async (req, res) => {
    try {
        const { uid, fullName, email, role, phone, idNumber } = req.body;

        if (!uid || !fullName || !email || !role || !phone) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        await createPatientProfile(uid, fullName, email, role, phone, idNumber);

        return res.status(201).json({
            success: true,
            message: "Patient record created successfully"
        });
    } catch (error) {
        console.error("Error creating patient:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create patient record",
            error: error.message
        });
    }
};

exports.createAdminProfile = async (req, res) => {
    try {
        const { uid, fullName, email, phone, adminCode } = req.body;

        if (!uid || !fullName || !email || !phone || !adminCode) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        // clinicId comes from the code itself, not the frontend
        const clinicId = await firebaseService.getClinicIdFromAdminCode(adminCode);
        if (!clinicId) {
            return res.status(403).json({
                success: false,
                message: "Invalid or already used admin code"
            });
        }

        const userData = { uid, fullName, email, phone, role: "admin" };
        const roleData = { adminCode, clinicId };

        await firebaseService.createUserProfile(userData, roleData);
        await firebaseService.claimClinic(clinicId, uid);

        return res.status(201).json({
            success: true,
            message: "Admin account created successfully"
        });
    } catch (error) {
        console.error("Error creating admin:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create admin record",
            error: error.message
        });
    }
};