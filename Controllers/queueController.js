const { getQueue, startConsultation } = require("../services/firebaseService");

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

exports.startConsultation = async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { queueItemId, staffId } = req.body;
 
        if (!clinicId) {
            return res.status(400).json({ success: false, message: "clinicId is required" });
        }
        if (!queueItemId) {
            return res.status(400).json({ success: false, message: "queueItemId is required" });
        }
        if (!staffId) {
            return res.status(400).json({ success: false, message: "staffId is required" });
        }
 
        const queueItem = await startConsultation(clinicId, queueItemId, staffId);
 
        res.status(200).json({ success: true, queueItem });
    } catch (error) {
        console.error("Error starting consultation:", error);
 
        if (
            error.message === "Patient is not in WAITING status" ||
            error.message === "Staff member already has a patient IN_CONSULTATION"
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid status transition",
                error: error.message,
            });
        }
 
        res.status(500).json({
            success: false,
            message: "Failed to start consultation",
            error: error.message,
        });
    }
};