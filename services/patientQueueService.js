const { db } = require("./config/firebase");

const ACTIVE_QUEUE_STATUSES = ["WAITING", "IN_CONSULTATION"];

// Treats only waiting and in-consultation queue items as visible to patients.
function isActiveQueueItem(queueItem) {
    return ACTIVE_QUEUE_STATUSES.includes(String(queueItem?.status || "WAITING").toUpperCase());
}

// Normalizes the queue item's time field, since older/newer flows store it
// under either timeSlot or appointmentTime.
function getQueueItemSlot(queueItem) {
    return String(queueItem?.timeSlot || queueItem?.appointmentTime || "").trim();
}

// Converts Date, Firestore Timestamp, epoch number, or date string values into
// milliseconds so queue entries can be ordered consistently.
function toMillis(value) {
    if (!value) {
        return null;
    }

    if (typeof value === "number") {
        return value;
    }

    if (value instanceof Date) {
        return value.getTime();
    }

    if (typeof value.toDate === "function") {
        return value.toDate().getTime();
    }

    if (typeof value.seconds === "number") {
        return (value.seconds * 1000) + Math.floor((value.nanoseconds || 0) / 1000000);
    }

    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
}

// Chooses the best available timestamp/queue number for ordering patients in a
// single slot.
function getQueueItemOrder(queueItem) {
    return toMillis(queueItem.appointmentCreatedAt) ||
        toMillis(queueItem.createdAt) ||
        Number(queueItem.queueNumber || 0);
}

// Uses the service duration stored on the queue item, falling back to 15
// minutes when the data is missing or invalid.
function getEstimatedServiceDuration(queueItem) {
    const serviceDuration = Number(queueItem?.serviceDuration);
    return Number.isFinite(serviceDuration) && serviceDuration > 0 ? serviceDuration : 15;
}

// Searches today's queue across clinics for the patient, then calculates their
// position and estimated wait based on patients ahead in the same time slot.
async function getPatientQueueInfo(patientId) {

    const today_date = new Date().toISOString().split("T")[0]; // "2026-05-17";

    const clinicSnapshot = await db.collection("clinics").get();

    for (const clinic of clinicSnapshot.docs) {

        const clinic_ID = clinic.id;

        const queueItemsSnapshot = await db
            .collection("clinics")
            .doc(clinic_ID)
            .collection("queues")
            .doc(today_date)
            .collection("queueItems")
            .where("patientId", "==", patientId)
            .get();

        if (!queueItemsSnapshot.empty) {

            const patientQueueDoc = queueItemsSnapshot.docs.find(doc => isActiveQueueItem(doc.data()));

            if (!patientQueueDoc) {
                return null;
            }

            const patient_Queue_Item = patientQueueDoc.data();
            const patientSlot = getQueueItemSlot(patient_Queue_Item);

            const allQueueSnapshot = await db
                .collection("clinics")
                .doc(clinic_ID)
                .collection("queues")
                .doc(today_date)
                .collection("queueItems")
                .get();

            const all_patients = allQueueSnapshot.docs
                .map(doc => doc.data())
                .filter(isActiveQueueItem)
                .filter(patient => getQueueItemSlot(patient) === patientSlot)
                .sort((a, b) => getQueueItemOrder(a) - getQueueItemOrder(b));

            const index = all_patients.findIndex(
                p => p.patientId === patientId
            );

            if (index === -1) {
                return null;
            }

            const position = index + 1;

            const patientsAheadList = all_patients.slice(0, index);

            const waitBeforeYou = patientsAheadList.reduce((total, patient) => {
                return total + getEstimatedServiceDuration(patient);
            }, 0);

            const estimatedWaitTime = waitBeforeYou;
            
            await patientQueueDoc.ref.update({
                estimatedWaitTime: estimatedWaitTime 
            });

            return {
                patientName: patient_Queue_Item.patientName,
                clinicName: patient_Queue_Item.clinicName,
                clinicAddress: patient_Queue_Item.clinicAddress,
                appointmentTime: patient_Queue_Item.appointmentTime,
                status: patient_Queue_Item.status || "WAITING",

                position,
                totalInQueue: all_patients.length,

                waitBeforeYou,

                estimatedWaitTime
            };
        }
    }

    return null;
}

module.exports = { getPatientQueueInfo };
