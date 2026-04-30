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

        if (user && (!userId || user.uid === userId)) {
            let redirectUrl = "/dashboard.html";

            if (user.role === "admin") {
                redirectUrl = "/adminDashboard.html";
            } else if (user.role === "staff") {
                if (user.approvalStatus === "pending") {
                    return res.json({
                        success: true,
                        exists: true,
                        pending: true,
                        message: "Your account is awaiting admin approval.",
                        profile: user
                    });
                }
                if (user.approvalStatus === "rejected") {
                    return res.json({
                        success: true,
                        exists: true,
                        rejected: true,
                        message: "Your staff application was declined.",
                        profile: user
                    });
                }
                redirectUrl = "/staffDashboard.html";
            }

            if ((user.role === "admin" || user.role === "staff") && user.clinicId) {
                try {
                    user.clinicName = await firebaseService.getClinicNameById(user.clinicId);
                } catch (error) {
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
        const {
            uid,
            fullName,
            email,
            role,
            phone,
            verificationCode,
            adminCode,
            staffCode
        } = req.body;

        if (!uid || !fullName || !email || !role || !phone) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        if (!["patient", "admin", "staff"].includes(role)) {
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
        let redirect = "/dashboard.html";
        let message = "Patient account created successfully";

        if (role === "admin") {
            const code = verificationCode || adminCode;

            if (!code) {
                return res.status(400).json({
                    success: false,
                    message: "Admin code is required"
                });
            }

            let clinicId = null;
            let verificationResult = null;

            if (typeof firebaseService.getClinicIdFromVerificationCode === "function") {
                verificationResult = await firebaseService.getClinicIdFromVerificationCode(code);
            }

            if (verificationResult) {
                if (verificationResult.role !== "admin") {
                    return res.status(403).json({
                        success: false,
                        message: "This code is not valid for Admin role"
                    });
                }

                clinicId = verificationResult.clinicId;
            } else {
                clinicId = await firebaseService.getClinicIdFromAdminCode(code);
            }

            if (!clinicId) {
                return res.status(403).json({
                    success: false,
                    message: "Invalid or already used admin code"
                });
            }

            const existingProfile = await firebaseService.getUserProfileById(uid);

            if (
                existingProfile &&
                existingProfile.role === "admin" &&
                existingProfile.clinicId &&
                existingProfile.clinicId !== clinicId
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You are already registered as an administrator for another clinic"
                });
            }

            if (verificationResult?.adminUid && verificationResult.adminUid !== uid) {
                return res.status(403).json({
                    success: false,
                    message: "This clinic is already managed by another administrator"
                });
            }

            roleData = { adminCode: code, clinicId };
            redirect = "/adminDashboard.html";
            message = "Admin account created successfully";

            await firebaseService.createUserProfile(userData, roleData);
            await firebaseService.claimClinic(clinicId, uid);
        } else if (role === "staff") {
            const code = verificationCode || staffCode;

            if (!code) {
                return res.status(400).json({
                    success: false,
                    message: "Staff code is required"
                });
            }

            const clinicId = await firebaseService.getStaffAssignmentFromCode(code);

            if (!clinicId) {
                return res.status(403).json({
                    success: false,
                    message: "You must be invited by an administrator to sign up as staff."
                });
            }

            roleData = { clinicId: invite.clinicId, approvalStatus: "pending" };
            redirect = "/login.html"; // Redirect to login to show pending message
            message = "Staff account created successfully. Awaiting admin approval.";

            await firebaseService.createUserProfile(userData, roleData);
            
            // Mark invite as accepted
            await admin.firestore().collection("clinicInvites").doc(email.toLowerCase().trim()).update({
                status: "accepted",
                acceptedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await firebaseService.createUserProfile(userData);
        }

        return res.status(201).json({
            success: true,
            message,
            role,
            redirect,
            profile: {
                ...userData,
                ...roleData
            }
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

exports.createUserProfile = exports.registerUser;

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
