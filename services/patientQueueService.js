const { db, admin } = require("./config/firebase");

const ACTIVE_QUEUE_STATUSES = ["WAITING", "IN_CONSULTATION"];

function isActiveQueueItem(queueItem) {
    return ACTIVE_QUEUE_STATUSES.includes(String(queueItem?.status || "WAITING").toUpperCase());
}

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

            const allQueueSnapshot = await db
                .collection("clinics")
                .doc(clinic_ID)
                .collection("queues")
                .doc(today_date)
                .collection("queueItems")
                .orderBy("createdAt")
                .get();

            const all_patients = allQueueSnapshot.docs
                .map(doc => doc.data())
                .filter(isActiveQueueItem);

            const index = all_patients.findIndex(
                p => p.patientId === patientId
            );

            if (index === -1) {
                return null;
            }

            const position = index + 1;

            const patientsAheadList = all_patients.slice(0, index);

            const waitBeforeYou = patientsAheadList.reduce((total, patient) => {
                return total + (patient.serviceDuration || 0);
            }, 0);

            const now = new Date();

            const appointmentStartTime = patient_Queue_Item.appointmentTime
                .split(" - ")[0];

            const appointmentDateTime = new Date(
                `${today_date}T${appointmentStartTime}:00`
            );

            // difference between now and appointment start in minutes
            const timeUntilAppointment = Math.max(
                0,
                Math.floor((appointmentDateTime - now) / 60000)
            );

            // final estimated wait
            const estimatedWaitTime =
                waitBeforeYou + timeUntilAppointment;
            
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
