const firebaseService = require('../services/firebaseService');
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

        // If we found a user by email, ensure the UID matches or it's a placeholder
        // If it's a placeholder (no UID in records yet), we want them to go to Sign Up to link it
        if (user && user.uid === userId) {
            let redirectUrl = "/dashboard.html"; 
            if (user.role === "admin") redirectUrl = "/adminDashboard.html";
            else if (user.role === "staff") redirectUrl = "/staffDashboard.html";

            // If it's a clinic-related role, enrich with clinic name if possible
            if ((user.role === "admin" || user.role === "staff") && user.clinicId) {
                try {
                    user.clinicName = await firebaseService.getClinicNameById(user.clinicId);
                } catch (e) {
                    console.warn("Could not fetch clinic name for profile enrichment");
                }
            }

            return res.json({
                success: true,
                exists: true,
                redirect: redirectUrl,
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

exports.registerUser = async (req, res) => {
    try {
<<<<<<< HEAD
        const {
            uid,
            fullName,
            email,
            role,
            phone,
            adminCode,
            staffCode
        } = req.body;
=======
        const { uid, fullName, email, role, phone, idNumber, verificationCode } = req.body;
>>>>>>> 8990dce747880d8a601e65dc9606fbe4e9a7b29b

        if (!uid || !fullName || !email || !role || !phone) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

<<<<<<< HEAD
        if (!["patient", "admin", "staff"].includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Invalid role selected"
            });
        }
=======
        const userData = { uid, fullName, email, role, phone };
        const roleData = { idNumber: idNumber || "N/A" };
>>>>>>> 8990dce747880d8a601e65dc9606fbe4e9a7b29b

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
                const existingUserDoc = await firebaseService.getUserProfileById(uid);
                
                if (existingUserDoc) {
                    // If already an admin for a DIFFERENT clinic, block
                    if (existingUserDoc.role === "admin" && existingUserDoc.clinicId && existingUserDoc.clinicId !== verificationResult.clinicId) {
                        return res.status(403).json({ 
                            success: false, 
                            message: `You are already registered as an administrator for another clinic. You cannot manage more than one clinic.`
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
<<<<<<< HEAD

            roleData = { adminCode, clinicId };
            successMessage = "Admin account created successfully";

            await firebaseService.createUserProfile(userData, roleData);
            await firebaseService.claimClinic(clinicId, uid);
        } else if (role === "staff") {
            if (!staffCode) {
                return res.status(400).json({
                    success: false,
                    message: "Staff code is required"
                });
            }

            const clinicId = await firebaseService.getStaffAssignmentFromCode(staffCode);

            if (!clinicId) {
                return res.status(403).json({
                    success: false,
                    message: "Invalid staff code"
                });
            }

            roleData = { staffCode, clinicId };
            successMessage = "Staff account created successfully";

            await firebaseService.createUserProfile(userData, roleData);
        } else {
            successMessage = "Patient account created successfully";
            await firebaseService.createUserProfile(userData);
=======
>>>>>>> 8990dce747880d8a601e65dc9606fbe4e9a7b29b
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
