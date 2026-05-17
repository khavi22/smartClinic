const { admin, db } = require('../services/config/firebase');
const { getAvailabilityForDate, createAppointment, getAppointmentsByPatientId, cancelAppointment,getPatientProfileById } = require("../services/firebaseService");

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
                
                const localDate = new Date();
                const year = localDate.getFullYear();
                const month = String(localDate.getMonth() + 1).padStart(2, '0');
                const day = String(localDate.getDate()).padStart(2, '0');
                const todayStr = `${year}-${month}-${day}`;

                const isToday = dateObj === todayStr;
                const currentHour = localDate.getHours();

                // Merge recommendations into slots
                slots = slots.map(slot => {
                    const prediction = predictions.find(p => p.timeSlot === slot.time);
                    const slotHour = parseInt(slot.time);
                    const isFuture = !isToday || slotHour > currentHour;

                    if (prediction && prediction.recommended && isFuture) {
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

const firebaseService = require('../services/firebaseService');
const emailService    = require('../services/emailService');

exports.postAppointment = async (req, res) => {
    try {
        const { patientId, clinicId, date, timeSlot, clinicName, clinicAddress, serviceId, serviceName, serviceDuration, oldAppointmentId } = req.body;

        if (!date || !timeSlot) {
            return res.status(400).json({ error: "Missing date or timeSlot" });
        }

        if (!serviceId || !serviceName || !serviceDuration) {
            return res.status(400).json({ error: "Service information is required" });
        }

        // If this is a reschedule, cancel the old appointment first
        if (oldAppointmentId) {
            console.log(`Rescheduling: Cancelling old appointment ${oldAppointmentId}`);
            await cancelAppointment(oldAppointmentId);
        }

        const newAppointment = await createAppointment(clinicId, date, timeSlot, patientId, clinicName, clinicAddress, !!oldAppointmentId, serviceId, serviceName, serviceDuration);

        // ✉️ Send confirmation email
        try {
            const patient = await getPatientProfileById(patientId);

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
                const patient = await getPatientProfileById(appt.patientId);
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

exports.getSmartSuggestion = async (req, res) => {
    try {
        const localDate = new Date();
        const year = localDate.getFullYear();
        const month = String(localDate.getMonth() + 1).padStart(2, '0');
        const day = String(localDate.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        const mlBaseUrl = process.env.ML_SERVICE_URL;

        if (!mlBaseUrl) {
            return res.json({ 
                suggestion: "💡 AI Tip: Mid-week mornings are usually the quietest time to visit your local clinic." 
            });
        }

        const endDateObj = new Date(localDate);
        endDateObj.setDate(endDateObj.getDate() + 6);
        const yEnd = endDateObj.getFullYear();
        const mEnd = String(endDateObj.getMonth() + 1).padStart(2, '0');
        const dayEnd = String(endDateObj.getDate()).padStart(2, '0');
        const endDateStr = `${yEnd}-${mEnd}-${dayEnd}`;

        const clinicId = req.query.clinicId || '';
        const mlRes = await fetch(`${mlBaseUrl}/predict-range?startDate=${todayStr}&endDate=${endDateStr}&clinicId=${clinicId}`);
        if (!mlRes.ok) throw new Error("ML service unreachable");

        const mlData = await mlRes.json();
        const predictionsByDate = mlData.predictionsByDate || {};
        
        let bestToday = null;
        let bestFuture = null;
        const currentHour = localDate.getHours();

        // Object.keys gives keys in insertion order in python 3.7+ which is by date usually, 
        // but let's sort to be safe
        const sortedDates = Object.keys(predictionsByDate).sort();

        for (let i = 0; i < sortedDates.length; i++) {
            const dateKey = sortedDates[i];
            const recommendations = (predictionsByDate[dateKey] || []).filter(p => p.recommended);
            
            // Reconstruct a Date object from the string "YYYY-MM-DD"
            const [y, m, d] = dateKey.split('-').map(Number);
            const iterDate = new Date(y, m - 1, d);
            
            if (dateKey === todayStr) { // Today
                const validToday = recommendations.filter(p => parseInt(p.timeSlot) > currentHour);
                if (validToday.length > 0) {
                    bestToday = {
                        day: iterDate.toLocaleDateString('en-US', { weekday: 'long' }),
                        date: iterDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
                        time: validToday[0].timeSlot
                    };
                }
            } else if (!bestFuture && recommendations.length > 0) {
                bestFuture = {
                    day: iterDate.toLocaleDateString('en-US', { weekday: 'long' }),
                    date: iterDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
                    time: recommendations[0].timeSlot
                };
            }
        }

        if (bestToday || bestFuture) {
            res.json({
                hasPrediction: true,
                today: bestToday,
                future: bestFuture,
                hint: "Optimal windows for minimal wait time."
            });
        } else {
            res.json({
                hasPrediction: false,
                suggestion: "💡 AI Assistant: Traffic models suggest normal volume this week. Please select a time that fits your schedule."
            });
        }
    } catch (error) {
        console.error("Smart Suggestion Error:", error);
        res.json({ 
            hasPrediction: false,
            suggestion: "💡 AI Tip: For the fastest service, try to book your appointments at least 48 hours in advance." 
        });
    }
};