
const {
    getPatientQueueInfo
} = require("../services/patientQueueService");

async function getMyNextQueue(req, res) {
    try {
        const patientId = req.params.patientId;

        if (!patientId) {
            return res.status(400).json({
                success: false,
                message: "patientId is required",
            });
        }

        const queue = await getPatientQueueInfo(patientId);
        console.log("Controller - Next Queue:", queue);
        res.status(200).json({
            success: true,
            queue,
        });

    } catch (error) {
        console.error("Controller error:", error);

        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}

module.exports = {
    getMyNextQueue
};