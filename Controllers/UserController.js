const firebaseService = require("../services/firebaseService");
const { admin } = require("../services/config/firebase");

exports.checkUserLogin = async (req, res) => {
    try {
        const { userId } = req.params;
        const email = typeof req.query.email === "string" ? req.query.email.trim() : "";

        if (!userId && !email) {
            return res.status(400).json({ error: "Missing userId or email" });
        }

        const user =
            (userId ? await firebaseService.getUserProfileById(userId) : null) ||
            (email ? await firebaseService.getUserProfileByEmail(email) : null);

        if (user) {
            return res.json({
                success: true,
                exists: true,
                redirect: "/dashboard.html",
                profile: user
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

exports.createUserProfile = async (req, res) => {
    try {
        const {
            uid,
            fullName,
            email,
            role,
            phone,
            adminCode
            // staffCode
        } = req.body;

        if (!uid || !fullName || !email || !role || !phone) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        if (!["patient", "admin"].includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Invalid role selected"
            });
        }

        const userData = {
            uid,
            fullName,
            email,
            role,
            phone
        };

        let roleData = {};
        let successMessage = "User profile created successfully";

        if (role === "admin") {
            if (!adminCode) {
                return res.status(400).json({
                    success: false,
                    message: "Admin code is required"
                });
            }

            const clinicId = await firebaseService.getClinicIdFromAdminCode(adminCode);

            if (!clinicId) {
                return res.status(403).json({
                    success: false,
                    message: "Invalid or already used admin code"
                });
            }

            roleData = { adminCode, clinicId };
            successMessage = "Admin account created successfully";

            await firebaseService.createUserProfile(userData, roleData);
            await firebaseService.claimClinic(clinicId, uid);
        } else {
            // Staff signup is intentionally disabled in the backend for now.
            successMessage = "Patient account created successfully";
            await firebaseService.createUserProfile(userData);
        }

        return res.status(201).json({
            success: true,
            message: successMessage,
            profile: {
                ...userData,
                ...roleData
            }
        });
    } catch (error) {
        console.error("Error creating user profile:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create user profile",
            error: error.message
        });
    }
};

exports.deleteUserAccount = async (req, res) => {
    try {
        const authHeader = req.headers.authorization || "";

        if (!authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Missing authorization token"
            });
        }

        const idToken = authHeader.slice(7).trim();
        const decodedToken = await admin.auth().verifyIdToken(idToken);

        await firebaseService.deleteUserAccount(decodedToken.uid);

        return res.json({
            success: true,
            message: "Account deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting user account:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete user account",
            error: error.message
        });
    }
};
