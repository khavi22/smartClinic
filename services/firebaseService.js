const { db, admin } = require("./config/firebase");
const MAX_CAPACITY_PER_SLOT = 10;

// ======================= APPOINTMENTS =======================

// Get availability
const getAvailabilityForDate = async (clinicId, dateStr) => {
    const slots = [];

    for (let hour = 0; hour < 24; hour++) {
        const start = hour.toString().padStart(2, "0") + ":00";
        const end = ((hour + 1) % 24).toString().padStart(2, "0") + ":00";

        slots.push({
            id: hour,
            time: `${start} - ${end}`,
            total: MAX_CAPACITY_PER_SLOT,
            taken: 0,
            status: "available"
        });
    }

    try {
        let queryRef = db
            .collection("appointments")
            .where("date", "==", dateStr)
            .where("status", "==", "booked");

        if (clinicId && clinicId !== "default") {
            queryRef = queryRef.where("clinicId", "==", clinicId);
        }

        const snapshot = await queryRef.get();

        if (snapshot.empty) return slots;

        snapshot.forEach((doc) => {
            const appointment = doc.data();
            const slot = slots.find((s) => s.time === appointment.timeSlot);

            if (slot) {
                slot.taken += 1;

                if (slot.taken >= slot.total) {
                    slot.status = "full";
                } else if (slot.taken >= slot.total - 3) {
                    slot.status = "limited";
                }
            }
        });

        return slots;
    } catch (error) {
        console.error("Error reading appointments:", error);
        throw error;
    }
};

// Create appointment
const createAppointment = async (
    clinicId,
    dateStr,
    timeSlot,
    patientId,
    clinicName,
    clinicAddress,
    isReschedule = false
) => {
    try {
        const appointmentsRef = db.collection("appointments");

        if (!isReschedule) {
            const duplicateSnapshot = await appointmentsRef
                .where("patientId", "==", patientId)
                .where("date", "==", dateStr)
                .where("status", "==", "booked")
                .get();

            if (!duplicateSnapshot.empty) {
                throw new Error("You already have a booking for this day.");
            }
        }

        let capacityQuery = appointmentsRef
            .where("date", "==", dateStr)
            .where("timeSlot", "==", timeSlot)
            .where("status", "==", "booked");

        if (clinicId && clinicId !== "default") {
            capacityQuery = capacityQuery.where("clinicId", "==", clinicId);
        }

        const capacitySnapshot = await capacityQuery.get();

        if (capacitySnapshot.size >= MAX_CAPACITY_PER_SLOT) {
            throw new Error("This slot is full.");
        }

        const newAppointment = {
            clinicId: clinicId || "default",
            clinicName: clinicName || "Unknown Clinic",
            clinicAddress: clinicAddress || "N/A",
            date: dateStr,
            timeSlot,
            patientId,
            status: "booked",
            createdAt: new Date().toISOString()
        };

        const docRef = await appointmentsRef.add(newAppointment);

        return { id: docRef.id, ...newAppointment };
    } catch (error) {
        console.error("Error creating appointment:", error);
        throw error;
    }
};

const getAppointmentsByPatientId = async (patientId) => {
    try {
        const snapshot = await db
            .collection("appointments")
            .where("patientId", "==", patientId)
            .get();

        const appointments = [];

        snapshot.forEach((doc) => {
            appointments.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return appointments;
    } catch (error) {
        console.error("Error fetching appointments by patientId:", error);
        throw error;
    }
};

// ======================= PATIENTS =======================

// Get profile
const getUserProfileById = async (patientId) => {
    try {
        const docSnap = await db.collection("patients").doc(patientId).get();

        if (!docSnap.exists) return null;

        return { id: docSnap.id, ...docSnap.data() };
    } catch (error) {
        console.error("Error fetching profile:", error);
        throw error;
    }
};

// make a method to update booking status to cancel which is gonna be used by the controller

// Cancel booking by updating its status
const cancelAppointment = async (appointmentId) =>{
    try {
        const bookingRef = db.collection("appointments").doc(appointmentId);

        const bookingDoc = await bookingRef.get();

        if (!bookingDoc.exists) {
            throw new Error("Booking not found");
        }

        await bookingRef.update({
            status: "cancelled",
            updatedAt: new Date()
        });

        return { success: true, message: "Booking cancelled successfully" };

    } catch (error) {
        console.error("Error cancelling booking:", error);
        throw error;
    }
};
// ======================= ADMINS =======================
const createAdminProfile = async (adminData) => {
    adminData.createdAt = admin.firestore.FieldValue.serverTimestamp();
    await db.collection("admin").doc(adminData.uid).set(adminData);
};


module.exports = { getUserProfileById, createAppointment, getAvailabilityForDate, cancelAppointment, getAppointmentsByPatientId, cancelAppointment, createAdminProfile };