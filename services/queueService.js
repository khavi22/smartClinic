const { db, admin } = require("./config/firebase");

const MAX_CAPACITY_PER_SLOT = 10;
const QUEUE_STATUSES = ["WAITING", "IN_CONSULTATION", "COMPLETE", "MISSED"];
const LOCKED_QUEUE_STATUSES = ["COMPLETE", "MISSED"];
const MISSED_GRACE_PERIOD_MINUTES = 15;

// Returns today's date in YYYY-MM-DD format for queue document ids.
const getTodayDate = () => {
  return new Date().toLocaleDateString("en-CA");
};

// Builds the Firestore reference for one clinic's queueItems subcollection on
// a specific date.
const getQueueItemsRef = (clinicId, date = getTodayDate()) => {
  return db
    .collection("clinics")
    .doc(clinicId)
    .collection("queues")
    .doc(date)
    .collection("queueItems");
};


// Calculates appointment slot availability for a clinic/date using operating
// hours, slot capacity, and already-booked appointments.
const getAvailabilityForDate = async (clinicId, dateStr) => {
  let slots = [];
  let slotCapacity = MAX_CAPACITY_PER_SLOT;

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

  if (clinicId && clinicId !== "default") {
    const clinicDoc = await db.collection("clinics").doc(clinicId).get();

    if (clinicDoc.exists) {
      const clinicData = clinicDoc.data();
      slotCapacity = clinicData.slotCapacity ?? MAX_CAPACITY_PER_SLOT;
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

      slots = slots.map((slot) => ({ ...slot, total: slotCapacity }));
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
};

// Chooses the best human-readable patient name from a profile object.
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

// Reads a patient profile so queue items can show names/emails instead of only
// patient ids.
const getPatientProfile = async (patientId) => {
  if (!patientId) {
    return null;
  }

  const patientDoc = await db.collection("patients").doc(patientId).get();
  return patientDoc.exists ? patientDoc.data() : null;
};

// Adds patient name/email/phone details to a queue item when the queue item
// only contains a patientId.
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

// Parses the queue item's appointment slot into a JavaScript Date for missed
// appointment and same-day availability checks.
const getQueueItemStartTime = (queueItem) => {
  const date = queueItem.date || getTodayDate();
  const rawTime = queueItem.appointmentTime || queueItem.timeSlot || queueItem.time || "";
  const match = String(rawTime).match(/\b([01]\d|2[0-3]):([0-5]\d)\b/);

  if (!match) {
    return null;
  }

  return new Date(`${date}T${match[1]}:${match[2]}:00`);
};

// Determines whether a waiting patient has passed the missed grace period.
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

// Converts inputs like "09:15" or "09:00 - 10:00" into the one-hour slot
// format used throughout appointment and queue storage.
const normalizeToHourSlot = (value) => {
  const text = String(value || "").trim();

  if (!text || text === "--") {
    return null;
  }

  if (/^\d{2}:\d{2}\s-\s\d{2}:\d{2}$/.test(text)) {
    return text;
  }

  const match = text.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const start = `${String(hour).padStart(2, "0")}:00`;
  const end = `${String((hour + 1) % 24).padStart(2, "0")}:00`;

  return `${start} - ${end}`;
};

// Keeps staff from booking/rescheduling into a slot that has already passed
// beyond the missed grace period.
const isSlotStillUsableToday = (date, slotTime, now = new Date()) => {
  const startTime = getQueueItemStartTime({
    date,
    timeSlot: slotTime
  });

  if (!startTime || Number.isNaN(startTime.getTime())) {
    return false;
  }

  return now.getTime() - startTime.getTime() < MISSED_GRACE_PERIOD_MINUTES * 60 * 1000;
};

// Counts manual queue entries in a slot so availability includes both booked
// appointments and walk-ins.
const getQueueManualCountForSlot = async (clinicId, date, slotTime, excludeQueueItemId = null) => {
  const snapshot = await getQueueItemsRef(clinicId, date)
    .where("timeSlot", "==", slotTime)
    .get();

  let manualQueueCount = 0;

  snapshot.forEach((doc) => {
    const queueItem = doc.data();

    if (excludeQueueItemId && doc.id === excludeQueueItemId) {
      return;
    }

    if (!queueItem.appointmentId && !LOCKED_QUEUE_STATUSES.includes(queueItem.status)) {
      manualQueueCount += 1;
    }
  });

  return manualQueueCount;
};

// Combines appointment availability with manual queue counts to produce the
// real available capacity for each queue slot.
const getQueueSlotAvailability = async (clinicId, date, excludeQueueItemId = null) => {
  const slots = await getAvailabilityForDate(clinicId, date);

  return Promise.all(slots.map(async (slot) => {
    const manualQueueCount = await getQueueManualCountForSlot(clinicId, date, slot.time, excludeQueueItemId);
    const taken = slot.taken + manualQueueCount;
    const status = taken >= slot.total ? "full" : slot.status;

    return {
      ...slot,
      taken,
      status
    };
  }));
};

// Returns only queue slots that still have capacity and are still usable today.
const getAvailableQueueSlots = async (clinicId, date = getTodayDate(), excludeQueueItemId = null) => {
  const slots = await getQueueSlotAvailability(clinicId, date, excludeQueueItemId);
  const now = new Date();

  return slots.filter((slot) =>
    slot.taken < slot.total &&
    slot.status !== "full" &&
    isSlotStillUsableToday(date, slot.time, now)
  );
};

// Validates a requested slot or chooses the first open slot when no valid time
// was requested.
const resolveAvailableQueueSlot = async (clinicId, date, requestedTime, excludeQueueItemId = null) => {
  const requestedSlot = normalizeToHourSlot(requestedTime);
  const slots = await getQueueSlotAvailability(clinicId, date, excludeQueueItemId);
  const availableSlots = await getAvailableQueueSlots(clinicId, date, excludeQueueItemId);
  const now = new Date();

  if (requestedSlot) {
    const slot = slots.find((entry) => entry.time === requestedSlot);

    if (!slot) {
      throw new Error("Selected time is outside clinic operating hours.");
    }

    if (slot.taken >= slot.total || slot.status === "full") {
      throw new Error("This slot is full.");
    }

    if (!isSlotStillUsableToday(date, requestedSlot, now)) {
      throw new Error("This time slot is no longer available.");
    }

    return requestedSlot;
  }

  if (availableSlots.length === 0) {
    throw new Error("The clinic is fully booked for today.");
  }

  return availableSlots[0].time;
};

// Automatically marks waiting queue items as MISSED when their appointment
// time is too far in the past.
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

// Sorts queue items by priority, appointment time, then queue number so staff
// see the intended serving order.
const sortQueueItems = (patients) => {
  patients.sort((a, b) => {
    if ((a.priority || 0) !== (b.priority || 0)) {
      return (a.priority || 0) - (b.priority || 0);
    }

    if ((a.appointmentTime || "") !== (b.appointmentTime || "")) {
      return (a.appointmentTime || "").localeCompare(b.appointmentTime || "");
    }

    return (a.queueNumber || 0) - (b.queueNumber || 0);
  });
};

// Loads today's queue for a clinic, updates overdue missed patients, enriches
// patient details, sorts the entries, and groups them by status.
const getQueue = async (clinicId) => {
  const today = getTodayDate();
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
  sortQueueItems(enrichedPatients);

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

// Moves a waiting queue item into IN_CONSULTATION while ensuring the staff
// member does not already have another active consultation.
const startConsultation = async (clinicId, queueItemId, staffId) => {
  const today = getTodayDate();
  const queueItemsRef = getQueueItemsRef(clinicId, today);

  const staffActiveSnapshot = await queueItemsRef
    .where("assignedStaffId", "==", staffId)
    .where("status", "==", "IN_CONSULTATION")
    .get();

  if (!staffActiveSnapshot.empty) {
    throw new Error("Staff member already has a patient IN_CONSULTATION");
  }

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
    consultationStartedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: staffId,
  };

  await patientRef.update(updatedFields);

  return enrichQueueItemWithPatient({ queueItemId, ...patient, ...updatedFields });
};

// Completes an in-consultation queue item, calculates actual duration, and
// returns both the completed patient and the next waiting patient.
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

  const endMillis = Date.now();
  let actualDuration = null;
  if (patient.consultationStartedAt) {
    const startMillis = patient.consultationStartedAt.toDate 
      ? patient.consultationStartedAt.toDate().getTime()
      : new Date(patient.consultationStartedAt).getTime();
    actualDuration = Math.max(1, Math.round((endMillis - startMillis) / (60 * 1000)));
  } else {
    actualDuration = patient.serviceDuration || 15;
  }

  const completedFields = {
    status: "COMPLETE",
    consultationCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
    actualDuration,
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

  sortQueueItems(waitingPatients);

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

// Adds a manual/walk-in queue item after resolving a valid open slot.
const addQueueItem = async (clinicId, queueData) => {
  const today = getTodayDate();
  const patientName = String(queueData.patientName || "").trim();

  if (!patientName && !queueData.patientId) {
    throw new Error("patientName or patientId is required");
  }

  const date = queueData.date || today;
  const availableSlot = await resolveAvailableQueueSlot(
    clinicId,
    date,
    queueData.timeSlot || queueData.appointmentTime
  );

  const newQueueItem = {
    patientName: patientName || null,
    patientId: queueData.patientId || null,
    clinicId,
    date,
    timeSlot: availableSlot,
    appointmentTime: availableSlot,
    priority: Number(queueData.priority || 0),
    status: queueData.status || "WAITING",
    queueNumber: Date.now(),
    addedBy: queueData.addedBy || null,
    serviceId: queueData.serviceId || null,
    serviceName: queueData.serviceName || null,
    serviceDuration: queueData.serviceDuration || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const docRef = await getQueueItemsRef(clinicId, date).add(newQueueItem);
  return { queueItemId: docRef.id, ...newQueueItem };
};

// Updates a queue item status, records consultation timestamps/duration when
// needed, and mirrors complete/missed states to linked appointments.
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

  if (status === "MISSED" || status === "missed") {
    if (queueItem.appointmentId) {
      await db.collection("appointments").doc(queueItem.appointmentId).update({
        status:"missed",
        updatedAt: new Date().toISOString()
      });
    }
  }
  else if (status === "COMPLETE" || status === "complete") {
    if (queueItem.appointmentId) {
      await db.collection("appointments").doc(queueItem.appointmentId).update({
        status:"completed",
        updatedAt: new Date().toISOString()
      });
    }
  }


  if (status === "IN_CONSULTATION") {
    updatedFields.consultationStartedAt = admin.firestore.FieldValue.serverTimestamp();
  } else if (status === "COMPLETE") {
    updatedFields.consultationCompletedAt = admin.firestore.FieldValue.serverTimestamp();
    updatedFields.completedAt = admin.firestore.FieldValue.serverTimestamp();
    const endMillis = Date.now();
    let actualDuration = null;
    if (queueItem.consultationStartedAt) {
      const startMillis = queueItem.consultationStartedAt.toDate 
        ? queueItem.consultationStartedAt.toDate().getTime()
        : new Date(queueItem.consultationStartedAt).getTime();
      actualDuration = Math.max(1, Math.round((endMillis - startMillis) / (60 * 1000)));
    } else {
      actualDuration = queueItem.serviceDuration || 15;
    }
    updatedFields.actualDuration = actualDuration;
  }

  await queueItemRef.update(updatedFields);
  return enrichQueueItemWithPatient({ queueItemId, ...queueItem, ...updatedFields });
};

// Moves a waiting queue item to another open slot and updates the linked
// appointment time when present.
const rescheduleQueueItem = async (clinicId, queueItemId, timeSlot, staffId) => {
  const queueItemRef = getQueueItemsRef(clinicId).doc(queueItemId);
  const queueItemDoc = await queueItemRef.get();

  if (!queueItemDoc.exists) {
    throw new Error("Queue item not found");
  }

  const queueItem = queueItemDoc.data();

  if (LOCKED_QUEUE_STATUSES.includes(queueItem.status)) {
    throw new Error("Cannot reschedule a missed or complete queue item");
  }

  const date = queueItem.date || new Date().toISOString().split("T")[0];
  const availableSlot = await resolveAvailableQueueSlot(clinicId, date, timeSlot, queueItemId);
  const updatedFields = {
    timeSlot: availableSlot,
    appointmentTime: availableSlot,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: staffId || null
  };

  await queueItemRef.update(updatedFields);

  if (queueItem.appointmentId) {
    await db.collection("appointments").doc(queueItem.appointmentId).update({
      timeSlot: availableSlot,
      updatedAt: new Date().toISOString()
    });
  }

  return enrichQueueItemWithPatient({
    queueItemId,
    ...queueItem,
    ...updatedFields
  });
};

// Deletes one queue item from today's queue and returns the removed data.
const removeQueueItem = async (clinicId, queueItemId) => {
  const queueItemRef = getQueueItemsRef(clinicId).doc(queueItemId);
  const queueItemDoc = await queueItemRef.get();

  if (!queueItemDoc.exists) {
    throw new Error("Queue item not found");
  }

  await queueItemRef.delete();
  return { queueItemId, ...queueItemDoc.data() };
};

// Converts today's booked appointments into queue items, skipping any
// appointment that already has a queue item.
const addTodaysAppointmentsToQueue = async (clinicId) => {
  const today = getTodayDate();

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
      serviceId: appointment.serviceId || null,
      serviceName: appointment.serviceName || null,
      serviceDuration: appointment.serviceDuration || null,
      appointmentCreatedAt: appointment.createdAt || null,
      createdAt: appointment.createdAt || new Date()
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

module.exports = {
  getQueue,
  startConsultation,
  completeConsultation,
  addQueueItem,
  getAvailableQueueSlots,
  rescheduleQueueItem,
  updateQueueItemStatus,
  removeQueueItem,
  addTodaysAppointmentsToQueue
};
