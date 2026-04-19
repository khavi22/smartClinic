const firebaseService = require('../services/firebaseService');
const { getUserProfileById } = firebaseService;

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

exports.registerUser = async (req, res) => {
    try {
        const { uid, fullName, email, role, phone, idNumber, verificationCode } = req.body;

        if (!uid || !fullName || !email || !role || !phone) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        const userData = { uid, fullName, email, role, phone };
        const roleData = { idNumber: idNumber || "N/A" };

        // Handle verification codes for Admin and Staff
        if (role === "admin" || role === "staff") {
            if (!verificationCode) {
                return res.status(400).json({ success: false, message: "Verification code required for this role" });
            }

            const verificationResult = await firebaseService.getClinicIdFromVerificationCode(verificationCode);
            
            if (!verificationResult) {
                return res.status(403).json({ success: false, message: "Invalid verification code" });
            }

            // --- ONE ADMIN PER CLINIC CHECK ---
            if (role === "admin") {
                const { db } = require("../services/config/firebase");
                const existingUserDoc = await db.collection("users").doc(uid).get();
                
                if (existingUserDoc.exists) {
                    const existingData = existingUserDoc.data();
                    // If already an admin for a DIFFERENT clinic, block
                    if (existingData.role === "admin" && existingData.clinicId && existingData.clinicId !== verificationResult.clinicId) {
                        return res.status(403).json({ 
                            success: false, 
                            message: `You are already registered as an administrator for another clinic (${existingData.clinicId === "default" ? "Default Clinic" : "another location"}). You cannot manage more than one clinic.`
                        });
                    }
                }
            }

            // Ensure the role matches the code type
            if (role === "admin" && verificationResult.role !== "admin") {
                return res.status(403).json({ success: false, message: "This code is not valid for Admin role" });
            }

            // Check if clinic is already claimed by someone else
            if (role === "admin" && verificationResult.adminUid && verificationResult.adminUid !== uid) {
                return res.status(403).json({ 
                    success: false, 
                    message: "This clinic is already managed by another administrator" 
                });
            }

            roleData.clinicId = verificationResult.clinicId;
            roleData.verificationCode = verificationCode;

            if (role === "admin") {
                await firebaseService.claimClinic(verificationResult.clinicId, uid);
            }
        }

        await firebaseService.createUserProfile(userData, roleData);

        // Determine redirect based on role
        let redirect = "/dashboard.html";
        if (role === "admin") redirect = "/adminDashboard.html";
        else if (role === "staff") redirect = "/staffDashboard.html";

        return res.status(201).json({
            success: true,
            message: `${role.charAt(0).toUpperCase() + role.slice(1)} account created successfully`,
            role,
            redirect
        });

    } catch (error) {
        console.error("Registration error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to register user",
            error: error.message
        });
    }
};