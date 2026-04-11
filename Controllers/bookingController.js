const { getBookingsByPatientId } = require("../services/firebaseService");

exports.getBookingsByPatientId = async (req, res) => {
    try {
        const patientId = req.params.patientId;
        if (!patientId) {
            return res.status(400).json({ error: "Missing patientId" });
        }

        const bookings = await getBookingsByPatientId(patientId);

        res.json({ bookings });
    } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).json({ error: "Failed to fetch bookings" });
    }
};

