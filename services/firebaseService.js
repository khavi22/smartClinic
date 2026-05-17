const { db, admin } = require("./config/firebase");
const { v4: uuidv4 } = require("uuid");

const MAX_CAPACITY_PER_SLOT = 10;
const ROLE_COLLECTIONS = {
    patient: "patients",
    admin: "admins",
    staff: "staff"
};
const SEARCH_COLLECTIONS = [...Object.values(ROLE_COLLECTIONS), "users"];

const getCollectionNameForRole = (role) => ROLE_COLLECTIONS[role];

const getAvailabilityForDate = async (clinicId, dateStr) => {
    let slots = [];

    for (let hour = 0; hour < 24; hour += 1) {
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
        if (clinicId && clinicId !== "default") {
            const clinicDoc = await db.collection("clinics").doc(clinicId).get();

            if (clinicDoc.exists) {
                const clinicData = clinicDoc.data();
                const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
                const dayOfWeek = days[new Date(dateStr).getDay()];
                const hours = clinicData.operatingHours ? clinicData.operatingHours[dayOfWeek] : null;

                if (!hours || !hours.isOpen) {
                    return [];
                }

                const closeTime =
                    hours.close === "00:00" && hours.open === "00:00" && hours.isOpen
                        ? "24:00"
                        : hours.close;

                slots = slots.filter((slot) => {
                    const slotStart = slot.time.split(" - ")[0];
                    return slotStart >= hours.open && slotStart < closeTime;
                });
            }
        }

        let queryRef = db
            .collection("appointments")
            .where("date", "==", dateStr)
            .where("status", "==", "booked");

        if (clinicId && clinicId !== "default") {
            queryRef = queryRef.where("clinicId", "==", clinicId);
        }

        const snapshot = await queryRef.get();

        if (snapshot.empty) {
            return slots;
        }

        snapshot.forEach((doc) => {
            const appointment = doc.data();
            const slot = slots.find((entry) => entry.time === appointment.timeSlot);

            if (!slot) {
                return;
            }

            slot.taken += 1;

            if (slot.taken >= slot.total) {
                slot.status = "full";
            } else if (slot.taken >= slot.total - 3) {
                slot.status = "limited";
            }
        });

        return slots;
    } catch (error) {
        console.error("Error reading appointments:", error);
        throw error;
    }
};

const createAppointment = async (
    clinicId,
    dateStr,
    timeSlot,
    patientId,
    clinicName,
    clinicAddress,
    isReschedule = false,
    serviceId = null,
    serviceName = null,
    serviceDuration = null
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
            serviceId: serviceId || null,
            serviceName: serviceName || null,
            serviceDuration: serviceDuration || null,
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


const getUserProfileById = async (userId) => {
    for (const collectionName of SEARCH_COLLECTIONS) {
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

    await admin.auth().setCustomUserClaims(uid, { role });

    const profileData = {
        uid,
        fullName: userData.fullName,
        email: userData.email,
        role,
        phone: userData.phone,
        ...roleData,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (role === "staff") {
        profileData.approvalStatus = "pending";
    }

    await db.collection(collectionName).doc(uid).set(profileData);
};

const getUserProfileByEmail = async (email) => {
    const trimmedEmail = String(email || "").trim();

    if (!trimmedEmail) {
        return null;
    }

    for (const collectionName of SEARCH_COLLECTIONS) {
        const snapshot = await db.collection(collectionName)
            .where("email", "==", trimmedEmail)
            .get();

        if (!snapshot.empty) {
            return snapshot.docs[0].data();
        }
    }

    return null;
};

const cancelAppointment = async (appointmentId) => {
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

const validateAdminCode = async (adminCode, clinicId) => {
    const snapshot = await db.collection("adminCodes")
        .where("code", "==", adminCode)
        .where("clinicId", "==", clinicId)
        .where("used", "==", false)
        .get();

    return !snapshot.empty;
};

const seedClinicDefaultServices = async (clinicId) => {
    try {
        const templatesSnapshot = await db.collection("serviceTemplates").get();
        let servicesToSeed = [];

        if (!templatesSnapshot.empty) {
            templatesSnapshot.forEach(doc => {
                const data = doc.data();
                servicesToSeed.push({
                    name: data.name,
                    description: data.description,
                    duration: data.duration
                });
            });
        } else {
            // Fallback standard templates if collection is empty
            servicesToSeed = [
                { name: "General Consultation", description: "Initial consultation with a general practitioner", duration: 30 },
                { name: "Dental Cleaning", description: "Professional teeth cleaning and examination", duration: 45 },
                { name: "Vaccination", description: "Immunization and vaccine administration", duration: 15 },
                { name: "Pediatric Check-up", description: "Routine wellness exam for children", duration: 30 }
            ];
        }

        const batch = db.batch();
        const servicesCollection = db.collection("clinics").doc(clinicId).collection("services");

        servicesToSeed.forEach(service => {
            const ref = servicesCollection.doc();
            batch.set(ref, {
                ...service,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                active: true
            });
        });

        await batch.commit();
        console.log(`Successfully auto-seeded ${servicesToSeed.length} default services for clinic: ${clinicId}`);
    } catch (err) {
        console.error("Failed to seed default services for clinic:", clinicId, err);
    }
};

const createClinic = async ({ placeId, clinicName, city, address }) => {
    const adminCode = "ADM-" + uuidv4().substring(0, 6).toUpperCase();
    const defaultHours = { open: "00:00", close: "24:00", isOpen: true };

    await db.collection("clinics").doc(placeId).set({
        placeId,
        clinicName,
        city: city || "",
        address: address || "Address not provided",
        operatingHours: {
            monday: { ...defaultHours },
            tuesday: { ...defaultHours },
            wednesday: { ...defaultHours },
            thursday: { ...defaultHours },
            friday: { ...defaultHours },
            saturday: { ...defaultHours },
            sunday: { ...defaultHours }
        },
        adminCode,
        adminUid: null,
        isActive: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { clinicId: placeId, adminCode };
};

const ensureClinicExists = async ({ clinicId, name, address }) => {
    const doc = await db.collection("clinics").doc(clinicId).get();

    if (doc.exists) {
        // Even if clinic exists, check if it has 0 services in subcollection. If so, seed them!
        const docRef = db.collection("clinics").doc(clinicId);
        if (typeof docRef.collection === "function") {
            const servicesSnapshot = await docRef.collection("services").limit(1).get();
            if (servicesSnapshot.empty) {
                console.log(`Existing clinic ${clinicId} has 0 services. Auto-seeding default services...`);
                await seedClinicDefaultServices(clinicId);
                return { success: true, alreadyExists: true, seededDefaultServices: true };
            }
        }
        return { success: true, alreadyExists: true };
    }

    await createClinic({
        placeId: clinicId,
        clinicName: name,
        address
    });

    await seedClinicDefaultServices(clinicId);

    return { success: true, newlyCreated: true };
};

const getClinicIdFromAdminCode = async (adminCode) => {
    const snapshot = await db.collection("clinics")
        .where("adminCode", "==", adminCode)
        .where("adminUid", "==", null)
        .where("isActive", "==", false)
        .get();

    if (snapshot.empty) {
        return null;
    }

    return snapshot.docs[0].id;
};

const getStaffAssignmentFromCode = async (staffCode) => {
    return null; // Legacy support removed
};

const getClinicIdFromVerificationCode = async (verificationCode) => {
    const adminClinicId = await getClinicIdFromAdminCode(verificationCode);

    if (adminClinicId) {
        return {
            clinicId: adminClinicId,
            role: "admin"
        };
    }

    return null;
};

const claimClinic = async (clinicId, uid) => {
    await db.collection("clinics").doc(clinicId).update({
        adminUid: uid,
        isActive: true
    });
};

const updateClinicOperatingHours = async (clinicId, operatingHours) => {
    await db.collection("clinics").doc(clinicId).update({
        operatingHours,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
};

const getClinicNameById = async (clinicId) => {
    const doc = await db.collection("clinics").doc(clinicId).get();
    return doc.exists ? doc.data().clinicName : "Unknown Clinic";
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

const deleteUserRoleDocuments = async (uid) => {
    await Promise.all(
        SEARCH_COLLECTIONS.map((collectionName) =>
            db.collection(collectionName).doc(uid).delete()
        )
    );
};

const inviteStaffByEmail = async (adminUid, clinicId, email) => {
    const trimmedEmail = email.toLowerCase().trim();
    const existingInvite = await db.collection("clinicInvites").doc(trimmedEmail).get();

    if (existingInvite.exists) {
        throw new Error("This email has already been invited.");
    }

    await db.collection("clinicInvites").doc(trimmedEmail).set({
        email: trimmedEmail,
        clinicId,
        invitedBy: adminUid,
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
};

const getInviteByEmail = async (email) => {
    const trimmedEmail = email.toLowerCase().trim();
    const doc = await db.collection("clinicInvites").doc(trimmedEmail).get();
    return doc.exists ? doc.data() : null;
};

const updateStaffApprovalStatus = async (staffUid, status) => {
    await db.collection("staff").doc(staffUid).update({
        approvalStatus: status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
};

const getPendingStaffByClinic = async (clinicId) => {
    const snapshot = await db.collection("staff")
        .where("clinicId", "==", clinicId)
        .where("approvalStatus", "==", "pending")
        .get();

    const staff = [];
    snapshot.forEach(doc => {
        staff.push({ uid: doc.id, ...doc.data() });
    });
    return staff;
};

const getActiveStaffByClinic = async (clinicId) => {
    const snapshot = await db.collection("staff")
        .where("clinicId", "==", clinicId)
        .where("approvalStatus", "==", "approved")
        .get();

    const staff = [];
    snapshot.forEach(doc => {
        staff.push({ uid: doc.id, ...doc.data() });
    });
    return staff;
};

const removeStaffFromClinic = async (staffUid) => {
    await db.collection("staff").doc(staffUid).update({
        approvalStatus: "removed",
        clinicId: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
};

const deleteUserAccount = async (uid) => {
    const profile = await getUserProfileById(uid);

    if (profile?.role === "admin") {
        await releaseAdminClinics(uid);
    }

    if (profile?.role === "patient") {
        await deleteUserAppointments(uid);
    }

    if (profile?.role === "staff" && profile?.email) {
        // Clean up invitation if account is deleted before approval or in general
        await db.collection("clinicInvites").doc(profile.email.toLowerCase().trim()).delete();
    }

    await deleteUserRoleDocuments(uid);
    await admin.auth().deleteUser(uid);

    return profile;
};


const getServiceTemplates = async () => {
  const snapshot = await db.collection("serviceTemplates").get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
};

const getClinicServices = async (clinicId) => {
  const snapshot = await db
    .collection("clinics")
    .doc(clinicId)
    .collection("services")
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
};

const addClinicService = async (clinicId, data) => {
  const ref = await db
    .collection("clinics")
    .doc(clinicId)
    .collection("services")
    .add({
      ...data,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      active: true,
    });

  return ref.id;
};

const updateClinicService = async (clinicId, serviceId, data) => {
  await db
    .collection("clinics")
    .doc(clinicId)
    .collection("services")
    .doc(serviceId)
    .update({
      ...data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
};

const deleteClinicService = async (clinicId, serviceId) => {
  await db
    .collection("clinics")
    .doc(clinicId)
    .collection("services")
    .doc(serviceId)
    .delete();
};

const serviceExists = async (clinicId, name) => {
  const snapshot = await db
    .collection("clinics")
    .doc(clinicId)
    .collection("services")
    .where("name", "==", name)
    .limit(1)
    .get();

  return !snapshot.empty;
};

module.exports = {
    createUserProfile,
    createClinic,
    ensureClinicExists,
    claimClinic,
    updateClinicOperatingHours,
    getClinicNameById,
    getClinicIdFromAdminCode,
    getStaffAssignmentFromCode,
    getClinicIdFromVerificationCode,
    getUserProfileByEmail,
    validateAdminCode,
    getUserProfileById,
    deleteUserAccount,
    createAppointment,
    getAvailabilityForDate,
    cancelAppointment,
    getAppointmentsByPatientId,
    inviteStaffByEmail,
    getInviteByEmail,
    updateStaffApprovalStatus,
    getPendingStaffByClinic,
    getActiveStaffByClinic,
    removeStaffFromClinic,
    getServiceTemplates,
    getClinicServices,
    addClinicService,
    updateClinicService,
    deleteClinicService,
    serviceExists
};

