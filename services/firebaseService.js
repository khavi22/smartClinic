const { db, admin } = require("./config/firebase");
const { v4: uuidv4 } = require('uuid');
const MAX_CAPACITY_PER_SLOT = 10;



// Get availability
const getAvailabilityForDate = async (clinicId, dateStr) => {
    let slots = [];
    
    // Default 24 slots
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
        // --- 1. Filter by Operating Hours ---
        if (clinicId && clinicId !== "default") {
            const clinicDoc = await db.collection("clinics").doc(clinicId).get();
            if (clinicDoc.exists) {
                const clinicData = clinicDoc.data();
                
                // More reliable day-of-week calculation
                const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
                const dayIndex = new Date(dateStr).getDay();
                const dayOfWeek = days[dayIndex];
                
                const hours = clinicData.operatingHours ? clinicData.operatingHours[dayOfWeek] : null;

                if (!hours || !hours.isOpen) {
                    return []; // Closed today
                }

                // Filter slots that fall within [open, close)
                slots = slots.filter(slot => {
                    const slotStart = slot.time.split(" - ")[0];
                    // Support 24h as 24:00
                    const closeTime = hours.close === "00:00" && hours.open === "00:00" && hours.isOpen ? "24:00" : hours.close;
                    return slotStart >= hours.open && slotStart < closeTime;
                });
            }
        }

        // --- 2. Calculate Taken Slots ---
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
    admin: "admins",
    staff: "staff"
};

const COLLECTION_NAMES = ["patients", "admins", "staff", "users"];
const getCollectionNameForRole = (role) => {
    if (role === "admin") return "admins";
    if (role === "patient") return "patients";
    return role; // staff is staff
};

const getUserProfileById = async (userId) => {
    for (const collectionName of COLLECTION_NAMES) {
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

    // 1. Set Custom Claims for security (keeping our logic)
    await admin.auth().setCustomUserClaims(uid, { role });

    const profileData = {
        uid,
        fullName: userData.fullName,
        email: userData.email,
        role,
        phone: userData.phone,
        idNumber: userData.idNumber || "N/A",
        ...roleData,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // 2. Save to individualized collection (keeping mate's logic)
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

const createClinic = async ({ placeId, clinicName, address }) => {
    const adminCode = "ADM-" + uuidv4().substring(0, 6).toUpperCase();
    const staffCode = "STF-" + uuidv4().substring(0, 6).toUpperCase();

    // Default to 24/7 as requested
    const defaultHours = { open: "00:00", close: "24:00", isOpen: true };

    await db.collection("clinics").doc(placeId).set({
        placeId,
        clinicName,
        address: address || "Address not provided",
        operatingHours: {
            monday:    { ...defaultHours },
            tuesday:   { ...defaultHours },
            wednesday: { ...defaultHours },
            thursday:  { ...defaultHours },
            friday:    { ...defaultHours },
            saturday:  { ...defaultHours },
            sunday:    { ...defaultHours }
        },
        adminCode,
        staffCode,
        adminUid: null,
        isActive: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { clinicId: placeId, adminCode, staffCode };
};

const ensureClinicExists = async ({ clinicId, name, address }) => {
    const doc = await db.collection("clinics").doc(clinicId).get();
    if (doc.exists) {
        return { success: true, alreadyExists: true };
    }

    await createClinic({
        placeId: clinicId,
        clinicName: name,
        address: address
    });

    return { success: true, newlyCreated: true };
};


<<<<<<< HEAD
// Validates the code and returns the clinicId if valid
const getClinicIdFromAdminCode = async (adminCode) => {
    const snapshot = await db.collection("clinics")
        .where("adminCode", "==", adminCode)
        .where("adminUid", "==", null)
        .where("isActive", "==", false)     // not yet active
=======
// Validates any verification code (Admin or Staff) and returns { clinicId, role, adminUid }
const getClinicIdFromVerificationCode = async (code) => {
    // Check Admin codes
    let snapshot = await db.collection("clinics")
        .where("adminCode", "==", code)
>>>>>>> 8990dce747880d8a601e65dc9606fbe4e9a7b29b
        .get();

    if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();
        return { 
            clinicId: doc.id, 
            role: "admin",
            adminUid: data.adminUid 
        };
    }

    // Check Staff codes
    snapshot = await db.collection("clinics")
        .where("staffCode", "==", code)
        .get();

    if (!snapshot.empty) {
        return { 
            clinicId: snapshot.docs[0].id, 
            role: "staff" 
        };
    }

    return null;
};

// Links the admin to the clinic on successful signup
<<<<<<< HEAD
const claimClinic = async (clinicId, uid) => {
    await db.collection("clinics").doc(clinicId).update({
        adminUid: uid,
=======
const claimClinic = async (clinicId, adminUid) => {
    await db.collection("clinics").doc(clinicId).update({
        adminUid: adminUid,
>>>>>>> 8990dce747880d8a601e65dc9606fbe4e9a7b29b
        isActive: true
    });
};

<<<<<<< HEAD
const getStaffAssignmentFromCode = async (staffCode) => {
    const snapshot = await db.collection("clinics")
        .where("staffCode", "==", staffCode)
        .get();

    if (snapshot.empty) {
        return null;
    }

    return snapshot.docs[0].id;
};


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
=======
const updateClinicOperatingHours = async (clinicId, operatingHours) => {
    await db.collection("clinics").doc(clinicId).update({
        operatingHours: operatingHours,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
>>>>>>> 8990dce747880d8a601e65dc9606fbe4e9a7b29b
};

const getClinicNameById = async (clinicId) => {
    const doc = await db.collection("clinics").doc(clinicId).get();
    return doc.exists ? doc.data().clinicName : "Unknown Clinic";
};

const deleteUserAccount = async (uid) => {
    try {
        // Find which collection the user is in
        const collections = Object.values(ROLE_COLLECTIONS);
        let foundProfile = null;
        let userRole = null;

        for (const collectionName of collections) {
            const doc = await db.collection(collectionName).doc(uid).get();
            if (doc.exists) {
                foundProfile = doc.data();
                userRole = foundProfile.role;
                // Delete from Firestore
                await db.collection(collectionName).doc(uid).delete();
                break;
            }
        }

        if (userRole === "admin") {
            // Unclaim the clinic
            const snapshot = await db.collection("clinics").where("adminUid", "==", uid).get();
            for (const doc of snapshot.docs) {
                await doc.ref.update({ adminUid: null, isActive: false });
            }
        } else if (userRole === "patient") {
            // Delete patient appointments
            const snapshot = await db.collection("appointments").where("patientId", "==", uid).get();
            for (const doc of snapshot.docs) {
                await doc.ref.delete();
            }
        }

        // Delete from Auth
        await admin.auth().deleteUser(uid);
        
        return foundProfile;
    } catch (error) {
        console.error("Error deleting user account:", error);
        throw error;
    }
};

module.exports = {
<<<<<<< HEAD
    createUserProfile,
    createClinic,
    claimClinic,
    getClinicIdFromAdminCode,
    getStaffAssignmentFromCode,
    getUserProfileByEmail,
    validateAdminCode,
=======
    // User management
>>>>>>> 8990dce747880d8a601e65dc9606fbe4e9a7b29b
    getUserProfileById,
    createUserProfile,
    getUserProfileByEmail,
    deleteUserAccount,
    
    // Clinic management
    createClinic,
    ensureClinicExists,
    getClinicIdFromVerificationCode,
    claimClinic,
    updateClinicOperatingHours,
    getClinicNameById,
    validateAdminCode,

    // Appointments & Availability
    createAppointment,
    getAvailabilityForDate,
    getAppointmentsByPatientId,
    cancelAppointment
};
