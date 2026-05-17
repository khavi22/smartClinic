const { db, admin } = require("./config/firebase");

async function getPatientQueueInfo(patientId) {

    const today_date = "2026-05-17";

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

            const patient_Queue_Item = queueItemsSnapshot.docs[0].data();

            const allQueueSnapshot = await db
                .collection("clinics")
                .doc(clinic_ID)
                .collection("queues")
                .doc(today_date)
                .collection("queueItems")
                .orderBy("createdAt")
                .get();

            const all_patients = allQueueSnapshot.docs.map(doc => doc.data());

            const index = all_patients.findIndex(
                p => p.patientId === patientId
            );

            const position = index + 1;

            const patientsAheadList = all_patients.slice(0, index);

            const waitBeforeYou = patientsAheadList.reduce((total, patient) => {
                return total + (patient.serviceDuration || 0);
            }, 0);

            const yourDuration =
                patient_Queue_Item.serviceDuration || 0;

            const estimatedWaitTime =
                waitBeforeYou + yourDuration;

            return {
                patientName: patient_Queue_Item.patientName,
                clinicName: patient_Queue_Item.clinicName,
                clinicAddress: patient_Queue_Item.clinicAddress,
                appointmentTime: patient_Queue_Item.appointmentTime,

                position,
                totalInQueue: all_patients.length,

                waitBeforeYou,
                yourDuration,
                estimatedWaitTime
            };
        }
    }

    return null;
}

module.exports = { getPatientQueueInfo };