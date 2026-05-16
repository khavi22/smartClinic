const { doc } = require("firebase/firestore/lite");
const { db, admin } = require("./config/firebase");

async function getPatientQueueInfo(patientId){
    // const today_date = new Date().toISOString().split("T")[0]
    const today_date="2026-05-11";


    const clinicSnapshot = await db.collection("clinics").get();
    const clinics_array = clinicSnapshot.docs;



    for (const clinic of clinics_array){
        const clinic_ID = clinic.id;

        const queueItemsSnapshot = await db
            .collection("clinics")
            .doc(clinic_ID)
            .collection("queues")
            .doc(today_date)
            .collection("queueItems")
            .where("patientId", "==", patientId)
            .get();


        if(!queueItemsSnapshot.empty){
            const patient_Queue_Item = queueItemsSnapshot.docs[0].data();

            const Get_AllQueue_Items= await db
                .collection("clinics")
                .doc(clinic_ID)
                .collection("queues")
                .doc(today_date)
                .collection("queueItems")
                .orderBy("createdAt")
                .get();

            //fetching all queue of patients from firestore and conveting them to a natural array
            const all_patients= Get_AllQueue_Items.docs.map(doc => doc.data());
            
            console.log("all patients:", all_patients.map(p => p.patientId)); // add this
            console.log("looking for:", patientId); // add this
            //then findindex goes to the array and find a position of that specific patient
            const index=all_patients.findIndex(p =>p.patientId == patientId)
            console.log("index found:", index);
           //number of people ahead of the patient
            const position_in_the_queue=index+1;
            const patients_ahead=index;
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