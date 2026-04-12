const { getAvailabilityForDate, createBooking, getBookingsByPatientId, cancelBooking } = require("../services/firebaseService");


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


exports.postBooking = async (req, res) => {
    try {
        const { clinicId, date, timeSlot, clinicName, clinicAddress, oldBookingId } = req.body;

        if (!date || !timeSlot) {
            return res.status(400).json({ error: "Missing date or timeSlot" });
        }

        // Current Mock patient ID for demo purposes
        const patientId = "demo_patient_123";

        // If this is a reschedule, cancel the old booking first
        if (oldBookingId) {
            console.log(`Rescheduling: Cancelling old booking ${oldBookingId}`);
            await cancelBooking(oldBookingId);
        }

        // Pass oldBookingId to createBooking to indicate a reschedule
        const newBooking = await createBooking(clinicId, date, timeSlot, patientId, clinicName, clinicAddress, !!oldBookingId);
        res.json({ success: true, booking: newBooking });
    } catch (error) {
        console.error("Failed to create booking:", error);

        // Handle specific validation errors returned from Firebase Service
        if (error.message.includes("full and unavailable") ||
            error.message.includes("already have a booking")) {
            return res.status(400).json({ error: error.message });
        }

        res.status(500).json({ error: "Failed to create booking. Please try again later." });
    }
};

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

exports.deleteBooking = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: "Missing booking ID" });
        }

        await cancelBooking(id);
        res.json({ success: true, message: "Booking cancelled successfully" });
    } catch (error) {
        console.error("Failed to cancel booking:", error);
        res.status(500).json({ error: "Failed to cancel booking" });
    }
};