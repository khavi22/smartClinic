const { getQueue } = require("../services/firebaseService");

exports.getQueue = async (req, res) => {
    try {
        const { clinicId } = req.params;

        if (!clinicId) {
            return res.status(400).json({ success: false, message: "clinicId is required" });
        }

        const queue = await getQueue(clinicId);

        res.status(200).json({ success: true, queue });
    } catch (error) {
        console.error("Error fetching queue:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch queue",
            error: error.message
        });
    }
};