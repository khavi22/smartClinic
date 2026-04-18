const { getUserProfileById, createPatientProfile } = require("../services/firebaseService");

exports.checkUserLogin = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ error: "Missing userId" });
        }

        const user = await getUserProfileById(userId);

        if (user) {
            return res.json({
                success: true,
                exists: true,
                redirect: "/dashboard.html"
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

