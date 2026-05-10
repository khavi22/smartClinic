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
        return { success: true, alreadyExists: true };
    }

    await createClinic({
        placeId: clinicId,
        clinicName: name,
        address
    });

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


// ======================= QUEUE =======================
const QUEUE_STATUSES = ["WAITING", "IN_CONSULTATION", "COMPLETE", "MISSED"];
const LOCKED_QUEUE_STATUSES = ["COMPLETE", "MISSED"];
const MISSED_GRACE_PERIOD_MINUTES = 15;

const getQueueItemsRef = (clinicId, date = new Date().toISOString().split("T")[0]) => {
  return db
    .collection("clinics")
    .doc(clinicId)
    .collection("queues")
    .doc(date)
    .collection("queueItems");
};

const getPatientDisplayName = (patient) => {
  if (!patient) {
    return null;
  }

  return patient.fullName ||
    patient.patientName ||
    patient.name ||
    patient.email ||
    null;
};

const getPatientProfile = async (patientId) => {
  if (!patientId) {
    return null;
  }

  const patientDoc = await db.collection("patients").doc(patientId).get();
  return patientDoc.exists ? patientDoc.data() : null;
};

const enrichQueueItemWithPatient = async (queueItem) => {
  if (queueItem.patientName || queueItem.fullName || !queueItem.patientId) {
    return queueItem;
  }

  const patientProfile = await getPatientProfile(queueItem.patientId);
  const patientName = getPatientDisplayName(patientProfile);

  return {
    ...queueItem,
    patientName: patientName || queueItem.patientId,
    patientEmail: patientProfile?.email || queueItem.patientEmail,
    patientPhone: patientProfile?.phone || queueItem.patientPhone
  };
};

const getQueueItemStartTime = (queueItem) => {
  const date = queueItem.date || new Date().toISOString().split("T")[0];
  const rawTime = queueItem.appointmentTime || queueItem.timeSlot || queueItem.time || "";
  const match = String(rawTime).match(/\b([01]\d|2[0-3]):([0-5]\d)\b/);

  if (!match) {
    return null;
  }

  return new Date(`${date}T${match[1]}:${match[2]}:00`);
};

const shouldMarkQueueItemMissed = (queueItem, now = new Date()) => {
  if (queueItem.status !== "WAITING") {
    return false;
  }

  const startTime = getQueueItemStartTime(queueItem);

  if (!startTime || Number.isNaN(startTime.getTime())) {
    return false;
  }

  return now.getTime() - startTime.getTime() >= MISSED_GRACE_PERIOD_MINUTES * 60 * 1000;
};

const markOverdueQueueItemsMissed = async (clinicId) => {
  const today = new Date().toISOString().split("T")[0];
  const queueItemsRef = getQueueItemsRef(clinicId, today);
  const snapshot = await queueItemsRef.where("status", "==", "WAITING").get();
  const now = new Date();
  const updates = [];

  snapshot.forEach((doc) => {
    const queueItem = {
      queueItemId: doc.id,
      ...doc.data()
    };

    if (shouldMarkQueueItemMissed(queueItem, now)) {
      updates.push(doc.ref.update({
        status: "MISSED",
        missedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: "system"
      }));
    }
  });

  await Promise.all(updates);
  return updates.length;
};

const getQueue = async (clinicId) => {
  const today = new Date().toISOString().split("T")[0];

  await markOverdueQueueItemsMissed(clinicId);

  const snapshot = await getQueueItemsRef(clinicId, today).get();

  const patients = [];

  snapshot.forEach((doc) => {
    patients.push({
      queueItemId: doc.id,
      ...doc.data()
    });
  });

  const enrichedPatients = await Promise.all(patients.map(enrichQueueItemWithPatient));

  enrichedPatients.sort((a, b) => {
    if ((a.priority || 0) !== (b.priority || 0)) {
      return (a.priority || 0) - (b.priority || 0);
    }

    if ((a.appointmentTime || "") !== (b.appointmentTime || "")) {
      return (a.appointmentTime || "").localeCompare(b.appointmentTime || "");
    }

    return (a.queueNumber || 0) - (b.queueNumber || 0);
  });

  const queue = {
    WAITING: [],
    IN_CONSULTATION: [],
    COMPLETE: [],
    MISSED: [],
  };

  enrichedPatients.forEach((patient) => {
    if (queue[patient.status]) {
      queue[patient.status].push(patient);
    }
  });

  return queue;
};

const startConsultation = async (clinicId, queueItemId, staffId) => {
    const today = new Date().toISOString().split("T")[0];

    const queueItemsRef = getQueueItemsRef(clinicId, today);

    // Check this staff member doesn't already have a patient IN_CONSULTATION
    const staffActiveSnapshot = await queueItemsRef
        .where("assignedStaffId", "==", staffId)
        .where("status", "==", "IN_CONSULTATION")
        .get();

    if (!staffActiveSnapshot.empty) {
        throw new Error("Staff member already has a patient IN_CONSULTATION");
    }

    // Fetch the target patient
    const patientRef = queueItemsRef.doc(queueItemId);
    const patientDoc = await patientRef.get();

    if (!patientDoc.exists) {
        throw new Error("Queue item not found");
    }

    const patient = patientDoc.data();

    if (patient.status !== "WAITING") {
        throw new Error("Patient is not in WAITING status");
    }

    const updatedFields = {
        status: "IN_CONSULTATION",
        assignedStaffId: staffId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: staffId,
    };

    await patientRef.update(updatedFields);

    return enrichQueueItemWithPatient({ queueItemId, ...patient, ...updatedFields });
};

const completeConsultation = async (clinicId, queueItemId, staffId) => {
  const queueItemsRef = getQueueItemsRef(clinicId);
  const queueItemRef = queueItemsRef.doc(queueItemId);
  const queueItemDoc = await queueItemRef.get();

  if (!queueItemDoc.exists) {
    throw new Error("Queue item not found");
  }

  const patient = queueItemDoc.data();

  if (patient.status !== "IN_CONSULTATION") {
    throw new Error("Patient is not IN_CONSULTATION");
  }

  const completedFields = {
    status: "COMPLETE",
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: staffId
  };

  await queueItemRef.update(completedFields);

  const waitingSnapshot = await queueItemsRef
    .where("status", "==", "WAITING")
    .get();

  const waitingPatients = [];

  waitingSnapshot.forEach((doc) => {
    waitingPatients.push({
      queueItemId: doc.id,
      ...doc.data()
    });
  });

  waitingPatients.sort((a, b) => {
    if ((a.priority || 0) !== (b.priority || 0)) {
      return (a.priority || 0) - (b.priority || 0);
    }

    if ((a.appointmentTime || "") !== (b.appointmentTime || "")) {
      return (a.appointmentTime || "").localeCompare(b.appointmentTime || "");
    }

    return (a.queueNumber || 0) - (b.queueNumber || 0);
  });

  const completed = await enrichQueueItemWithPatient({
    queueItemId,
    ...patient,
    ...completedFields
  });
  const nextPatient = waitingPatients[0]
    ? await enrichQueueItemWithPatient(waitingPatients[0])
    : null;

  return { completed, nextPatient };
};

const addQueueItem = async (clinicId, queueData) => {
  const today = new Date().toISOString().split("T")[0];
  const patientName = String(queueData.patientName || "").trim();

  if (!patientName && !queueData.patientId) {
    throw new Error("patientName or patientId is required");
  }

  const newQueueItem = {
    patientName: patientName || null,
    patientId: queueData.patientId || null,
    clinicId,
    date: queueData.date || today,
    timeSlot: queueData.timeSlot || queueData.appointmentTime || "--",
    appointmentTime: queueData.appointmentTime || queueData.timeSlot || "--",
    priority: Number(queueData.priority || 0),
    status: queueData.status || "WAITING",
    queueNumber: Date.now(),
    addedBy: queueData.addedBy || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const docRef = await getQueueItemsRef(clinicId, today).add(newQueueItem);
  return { queueItemId: docRef.id, ...newQueueItem };
};

const updateQueueItemStatus = async (clinicId, queueItemId, status, staffId) => {
  if (!QUEUE_STATUSES.includes(status)) {
    throw new Error("Invalid queue status");
  }

  const queueItemRef = getQueueItemsRef(clinicId).doc(queueItemId);
  const queueItemDoc = await queueItemRef.get();

  if (!queueItemDoc.exists) {
    throw new Error("Queue item not found");
  }

  const queueItem = queueItemDoc.data();

  if (LOCKED_QUEUE_STATUSES.includes(queueItem.status)) {
    throw new Error("Cannot update a missed or complete queue item");
  }

  const updatedFields = {
    status,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: staffId || null
  };

  await queueItemRef.update(updatedFields);
  return enrichQueueItemWithPatient({ queueItemId, ...queueItem, ...updatedFields });
};

const removeQueueItem = async (clinicId, queueItemId) => {
  const queueItemRef = getQueueItemsRef(clinicId).doc(queueItemId);
  const queueItemDoc = await queueItemRef.get();

  if (!queueItemDoc.exists) {
    throw new Error("Queue item not found");
  }

  await queueItemRef.delete();
  return { queueItemId, ...queueItemDoc.data() };
};

const addTodaysAppointmentsToQueue = async (clinicId) => {
  const today = new Date().toISOString().split("T")[0];

  const appointmentsSnapshot = await db
    .collection("appointments")
    .where("clinicId", "==", clinicId)
    .where("date", "==", today)
    .where("status", "==", "booked")
    .get();

  if (appointmentsSnapshot.empty) {
    return [];
  }

  const addedToQueue = [];

  for (const doc of appointmentsSnapshot.docs) {
    const appointment = doc.data();

    const queueDocRef = getQueueItemsRef(clinicId, today).doc(doc.id);

    const existingQueueDoc = await queueDocRef.get();

    if (existingQueueDoc.exists) {
      continue;
    }

    const queueData = {
      appointmentId: doc.id,
      patientId: appointment.patientId,
      clinicId: appointment.clinicId,
      clinicName: appointment.clinicName,
      clinicAddress: appointment.clinicAddress,
      date: appointment.date,
      timeSlot: appointment.timeSlot,

      status: "WAITING",
      priority: 0,
      appointmentTime: appointment.timeSlot,
      queueNumber: Date.now(),

      createdAt: new Date()
    };

    const patientProfile = await getPatientProfile(appointment.patientId);
    const patientName = getPatientDisplayName(patientProfile);

    if (patientName) {
      queueData.patientName = patientName;
      queueData.patientEmail = patientProfile.email || null;
      queueData.patientPhone = patientProfile.phone || null;
    }

    await queueDocRef.set(queueData);

    addedToQueue.push({
      queueItemId: doc.id,
      ...queueData
    });
  }

  return addedToQueue;
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
    getQueue,
    startConsultation,
    completeConsultation,
    addQueueItem,
    updateQueueItemStatus,
    removeQueueItem,
    addTodaysAppointmentsToQueue,
    getActiveStaffByClinic,
    removeStaffFromClinic,
    getServiceTemplates,
    getClinicServices,
    addClinicService,
    updateClinicService,
    deleteClinicService,
    serviceExists
};
