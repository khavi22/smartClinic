
const {
    getPatientQueueInfo
} = require("../services/patientQueueService");

// GET /api/patient/queue/:patientId
// Returns the patient's active queue position and estimated wait information
// for today's clinic queue, if they are currently waiting or in consultation.
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
