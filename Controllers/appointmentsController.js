const { getAvailabilityForDate, createAppointment, getAppointmentsByPatientId, cancelAppointment } = require("../services/firebaseService");

exports.getAvailability = async (req, res) => {
    try {
        const dateObj = req.query.date;
        const clinicId = req.query.clinicId || "default";

        if (!dateObj) {
            return res.status(400).json({ error: "Missing date parameter" });
        }

        let slots = await getAvailabilityForDate(clinicId, dateObj);
        
        // Fetch ML recommendations
        try {
            const mlBaseUrl = process.env.ML_SERVICE_URL;
            if (!mlBaseUrl) {
                throw new Error("ML_SERVICE_URL is not defined");
            }
            const mlRes = await fetch(`${mlBaseUrl}/predict?date=${dateObj}`);
            if (mlRes.ok) {
                const mlData = await mlRes.json();
                const predictions = mlData.predictions || [];
                
                // Merge recommendations into slots
                slots = slots.map(slot => {
                    const prediction = predictions.find(p => p.timeSlot === slot.time);
                    if (prediction && prediction.recommended) {
                        return { ...slot, isRecommended: true };
                    }
                    return slot;
                });
            }
        } catch (mlError) {
            console.log("ML service unavailable, proceeding without recommendations");
        }

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

        if (error.message.includes("slot is full") ||
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

exports.getSmartSuggestion = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const mlBaseUrl = process.env.ML_SERVICE_URL;

        if (!mlBaseUrl) {
            return res.json({ 
                suggestion: "💡 Tip: Mid-week mornings are usually the quietest time to visit your local clinic." 
            });
        }

        const mlRes = await fetch(`${mlBaseUrl}/predict?date=${today}`);
        if (!mlRes.ok) throw new Error("ML service unreachable");

        const mlData = await mlRes.json();
        const recommendations = (mlData.predictions || []).filter(p => p.recommended);

        if (recommendations.length > 0) {
            const bestSlot = recommendations[0].timeSlot;
            const dateObj = new Date(today);
            res.json({
                hasPrediction: true,
                day: dateObj.toLocaleDateString('en-US', { weekday: 'long' }),
                date: dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'long' }),
                time: bestSlot,
                hint: "Optimal time for a shorter wait."
            });
        } else {
            res.json({
                hasPrediction: false,
                suggestion: "💡 AI Tip: Clinic traffic is normal today. You should be able to find a comfortable slot in the afternoon."
            });
        }
    } catch (error) {
        console.error("Smart Suggestion Error:", error);
        res.json({ 
            suggestion: "💡 Tip: Remember to book at least 24 hours in advance for the best availability." 
        });
    }
};