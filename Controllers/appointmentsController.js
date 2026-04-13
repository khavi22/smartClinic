const { getAvailabilityForDate, createAppointment, getAppointmentsByPatientId, cancelAppointment } = require("../services/firebaseService");

exports.getAvailability = async (req, res) => {
    try {
        const dateObj = req.query.date;
        const clinicId = req.query.clinicId || "default";

        if (!dateObj) {
            return res.status(400).json({ error: "Missing date parameter" });
        }

        const slots = await getAvailabilityForDate(clinicId, dateObj);
        res.json({ date: dateObj, slots });
    } catch (error) {
        console.error("Failed to get availability:", error);
        res.status(500).json({ error: "Failed to fetch availability data." });
    }
};

exports.postAppointment = async (req, res) => {
    try {
        const { patientId, clinicId, date, timeSlot, clinicName, clinicAddress, oldAppointmentId } = req.body;

        if (!date || !timeSlot) {
            return res.status(400).json({ error: "Missing date or timeSlot" });
        }

        // If this is a reschedule, cancel the old appointment first
        if (oldAppointmentId) {
            console.log(`Rescheduling: Cancelling old appointment ${oldAppointmentId}`);
            await cancelAppointment(oldAppointmentId);
        }

        const newAppointment = await createAppointment(clinicId, date, timeSlot, patientId, clinicName, clinicAddress, !!oldAppointmentId);
        res.json({ success: true, appointment: newAppointment });
    } catch (error) {
        console.error("Failed to create appointment:", error);

        if (error.message.includes("full and unavailable") ||
            error.message.includes("already have a booking")) {
            return res.status(400).json({ error: error.message });
        }

        res.status(500).json({ error: "Failed to create appointment. Please try again later." });
    }
};

exports.getAppointmentsByPatientId = async (req, res) => {
    try {
        const patientId = req.params.patientId;

        if (!patientId) {
            return res.status(400).json({ error: "Missing patientId" });
        }

        const appointments = await getAppointmentsByPatientId(patientId);
        res.json({ appointments });
    } catch (error) {
        console.error("Error fetching appointments:", error);
        res.status(500).json({ error: "Failed to fetch appointments" });
    }
};
// make the put/post that updates status to cancelled by using function from firebaseService
// Controller to cancel a booking
exports.cancelAppointmentController = async (req, res) => {
    try {
        const appointmentId = req.params.id;

        // Validate input
        if (!appointmentId) {
            return res.status(400).json({
                success: false,
                message: "Appointment ID is required"
            });
        }

        // Call service
        const result = await cancelAppointment(appointmentId);

        return res.status(200).json({
            success: true,
            message: result.message
        });

    } catch (error) {
        console.error("Cancel Appointment Controller Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to cancel appointment",
            error: error.message
        });
    }
};