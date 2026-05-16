const { doc } = require("firebase/firestore/lite");
const { db, admin } = require("./config/firebase");

async function getPatientQueueInfo(patientId){
    const today_date = new Date().toISOString().split("T")[0]


    const clinicSnapshot = await db.collection("clinics").get();
    const clinics_array = clinicSnapshot.docs;



    for (const clinic of clinics_array){
        const clinic_ID = clinic.id;

        const queueItemsSnapshot = await db
            .collection("clinics")
            .doc(clinicId)
            .collection("queues")
            .doc(today)
            .collection("queueItems")
            .where("patientId", "==", patientId)
            .get();


        if(!queueItemsSnapshot.empty){
            const patient_Queue_Item = queueItemsSnapshot.docs[0].data();

            const Get_AllQueue_Items= await db
                .collection("clinics")
                .doc(clinicId)
                .collection("queues")
                .doc(today)
                .collection("queueItems")
                .orderBy("createdAt")
                .get();


            const all_patients= Get_AllQueue_Items.docs.map(doc => doc.data());
            const position_in_the_queue=all_patients.findIndex(p =>p.patientId == patientId)

            const patients_ahead=position_in_the_queue-1;
            const estimated_wait_time=patients_ahead*15

            return{
                patientName: patient_Queue_Item.patientName,
                clinicName:   patient_Queue_Item.clinicName,
                clinicAddress:   patient_Queue_Item.clinicAddress,
                appointmentTime:  patient_Queue_Item.appointmentTime,
                position: position_in_the_queue,
                totalInQueue: all_patients.length,
                estimatedWaitTime: estimated_wait_time
            };

        }
    }

    return null;
}

module.exports = {getPatientQueueInfo};