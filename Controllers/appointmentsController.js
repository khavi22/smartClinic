const { admin, db } = require('../services/config/firebase');
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

const firebaseService = require('../services/firebaseService');
const emailService    = require('../services/emailService');

exports.postAppointment = async (req, res) => {
    try {
        const { patientId, clinicId, date, timeSlot, clinicName, clinicAddress, oldAppointmentId } = req.body;

        if (!date || !timeSlot) {
            return res.status(400).json({ error: "Missing date or timeSlot" });
        }

        if (oldAppointmentId) {
            console.log(`Rescheduling: Cancelling old appointment ${oldAppointmentId}`);
            await cancelAppointment(oldAppointmentId);
        }

        const newAppointment = await createAppointment(
            clinicId, date, timeSlot, patientId, clinicName, clinicAddress, !!oldAppointmentId
        );

        // ✉️ Send confirmation email
        try {
            const patient = await firebaseService.getUserProfileById(patientId);

            // Only send if patient exists and has an email
            if (patient?.email) {
                await emailService.sendAppointmentConfirmation(
                    patient.email,           
                    patient.fullName,        
                    clinicName,
                    clinicAddress,
                    date,
                    timeSlot,
                    !!oldAppointmentId       
                );
                console.log(`✅ Confirmation email sent to ${patient.email}`);
            } else {
                console.warn(`⚠️ No email found for patientId: ${patientId}`);
            }
        } catch (emailError) {
            // Email failure never blocks the appointment saving
            console.error("❌ Failed to send confirmation email:", emailError);
        }

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

        if (!appointmentId) {
            return res.status(400).json({
                success: false,
                message: "Appointment ID is required"
            });
        }

        // Fetch appointment BEFORE cancelling to get details for email
        const appointmentDoc = await admin.firestore()
            .collection('appointments')
            .doc(appointmentId)
            .get();

        const result = await cancelAppointment(appointmentId);

        // ✉️ Send cancellation email
        try {
            if (appointmentDoc.exists) {
                const appt = appointmentDoc.data();
                const patient = await firebaseService.getPatientProfileById(appt.patientId);
                if (patient?.email) {
                    await emailService.sendAppointmentCancellation(
                        patient.email,
                        patient.fullName,
                        appt.clinicName,
                        appt.clinicAddress,
                        appt.date,
                        appt.timeSlot
                    );
                    console.log(`✅ Cancellation email sent to ${patient.email}`);
                }
            }
        } catch (emailError) {
            console.error("❌ Failed to send cancellation email:", emailError);
        }

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