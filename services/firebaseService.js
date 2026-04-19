const { db, admin } = require("./config/firebase");
const { v4: uuidv4 } = require('uuid');
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
// ======================= USERS =======================
const ROLE_COLLECTIONS = {
    patient: "patients",
    admin: "admins"
    // staff: "staff"
};

const getCollectionNameForRole = (role) => ROLE_COLLECTIONS[role];
const COLLECTION_NAMES = Object.values(ROLE_COLLECTIONS);

const getUserProfileById = async (userId) => {
    const collections = Object.values(ROLE_COLLECTIONS);

    for (const collectionName of collections) {
        const doc = await db.collection(collectionName).doc(userId).get();

        if (doc.exists) {
            return doc.data();
        }
    }

    return null;
};

const createUserProfile = async (userData, roleData = {}) => {
    const { uid, role } = userData;
    const collectionName = getCollectionNameForRole(role);

    if (!collectionName) {
        throw new Error("Unsupported role");
    }

    const profileData = {
        uid,
        fullName: userData.fullName,
        email: userData.email,
        role,
        phone: userData.phone,
        ...roleData,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection(collectionName).doc(uid).set(profileData);
};

const getUserProfileByEmail = async (email) => {
    const trimmedEmail = String(email || "").trim();

    if (!trimmedEmail) {
        return null;
    }

    const collections = Object.values(ROLE_COLLECTIONS);

    for (const collectionName of collections) {
        const snapshot = await db.collection(collectionName)
            .where("email", "==", trimmedEmail)
            .get();

        if (!snapshot.empty) {
            return snapshot.docs[0].data();
        }
    }

    return null;
};
// ======================= PATIENTS =======================

// Get profile


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


// ======================= VALIDATION =======================

// Checks a pre-generated admin code exists for the given clinic
const validateAdminCode = async (adminCode, clinicId) => {
    const snapshot = await db.collection("adminCodes")
        .where("code", "==", adminCode)
        .where("clinicId", "==", clinicId)
        .where("used", "==", false)
        .get();

    return !snapshot.empty;
};
// ======================= CLINICS =======================

const createClinic = async ({ placeId, clinicName, city }) => {
    const code = "ADM-" + uuidv4().substring(0, 6).toUpperCase();

    await db.collection("clinics").doc(placeId).set({
        placeId,
        clinicName,
        city,
        operatingHours: {
            monday:    { open: "08:00", close: "17:00", isOpen: true },
            tuesday:   { open: "08:00", close: "17:00", isOpen: true },
            wednesday: { open: "08:00", close: "17:00", isOpen: true },
            thursday:  { open: "08:00", close: "17:00", isOpen: true },
            friday:    { open: "08:00", close: "17:00", isOpen: true },
            saturday:  { open: "08:00", close: "13:00", isOpen: true },
            sunday:    { open: "00:00", close: "00:00", isOpen: false }
        },
        adminCode: code,
        adminUid: null,
        isActive: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { clinicId: placeId, adminCode: code };
};


// Validates the code and returns the clinicId if valid
const getClinicIdFromAdminCode = async (adminCode) => {
    const snapshot = await db.collection("clinics")
        .where("adminCode", "==", adminCode)
        .where("adminUid", "==", null)      // not yet claimed
        .where("isActive", "==", false)     // not yet active
        .get();

    if (snapshot.empty) return null;

    return snapshot.docs[0].id;
};

// Links the admin to the clinic on successful signup
const claimClinic = async (clinicId, uid) => {
    await db.collection("clinics").doc(clinicId).update({
        adminUid: uid,
        isActive: true
    });
};

// const getStaffAssignmentFromCode = async (staffCode) => {
//     const snapshot = await db.collection("staffCodes")
//         .where("code", "==", staffCode)
//         .where("used", "==", false)
//         .get();
//
//     if (snapshot.empty) {
//         return null;
//     }
//
//     const staffCodeDoc = snapshot.docs[0];
//     const staffCodeData = staffCodeDoc.data();
//
//     if (!staffCodeData.clinicId) {
//         return null;
//     }
//
//     return {
//         staffCodeId: staffCodeDoc.id,
//         clinicId: staffCodeData.clinicId
//     };
// };

// const claimStaffCode = async (staffCodeId, uid) => {
//     await db.collection("staffCodes").doc(staffCodeId).update({
//         used: true,
//         staffUid: uid,
//         usedAt: admin.firestore.FieldValue.serverTimestamp()
//     });
// };

const deleteUserAppointments = async (uid) => {
    const appointmentsSnapshot = await db.collection("appointments")
        .where("patientId", "==", uid)
        .get();

    if (appointmentsSnapshot.empty) {
        return;
    }

    await Promise.all(
        appointmentsSnapshot.docs.map((doc) => doc.ref.delete())
    );
};

const releaseAdminClinics = async (uid) => {
    const clinicsSnapshot = await db.collection("clinics")
        .where("adminUid", "==", uid)
        .get();

    if (clinicsSnapshot.empty) {
        return;
    }

    await Promise.all(
        clinicsSnapshot.docs.map((doc) =>
            doc.ref.update({
                adminUid: null,
                isActive: false
            })
        )
    );
};

// const releaseStaffCodes = async (uid) => {
//     const staffCodesSnapshot = await db.collection("staffCodes")
//         .where("staffUid", "==", uid)
//         .get();
//
//     if (staffCodesSnapshot.empty) {
//         return;
//     }
//
//     await Promise.all(
//         staffCodesSnapshot.docs.map((doc) =>
//             doc.ref.update({
//                 used: false,
//                 staffUid: null,
//                 usedAt: null
//             })
//         )
//     );
// };

const deleteUserRoleDocuments = async (uid) => {
    await Promise.all(
        COLLECTION_NAMES.map((collectionName) =>
            db.collection(collectionName).doc(uid).delete()
        )
    );
};

const deleteUserAccount = async (uid) => {
    const profile = await getUserProfileById(uid);

    if (profile?.role === "admin") {
        await releaseAdminClinics(uid);
    }

    // if (profile?.role === "staff") {
    //     await releaseStaffCodes(uid);
    // }

    await deleteUserAppointments(uid);
    await deleteUserRoleDocuments(uid);
    await admin.auth().deleteUser(uid);

    return profile;
};

module.exports = {
    createUserProfile,
    createClinic,
    claimClinic,
    getClinicIdFromAdminCode,
    getUserProfileByEmail,
    validateAdminCode,
    getUserProfileById,
    deleteUserAccount,
    createAppointment,
    getAvailabilityForDate,
    cancelAppointment,
    getAppointmentsByPatientId
};
