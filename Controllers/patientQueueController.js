const { error } = require("joi/lib/types/alternatives");
const { getPatientQueueInfo } = require("../services/patientQueueService");


async function fetchPatientQueueInfo(req,res){
    try{
        const patient_ID = req.params.patientId;

        if(!patient_ID){
            return res.status(400).json({error :"Patient ID is required"});
        }

        const queueInfo = await getPatientQueueInfo(patient_ID);

        if(!queueInfo){
            return res.status(404).json({ error: "Patient not found in today's queue" });
        }
        res.json({ queueInfo });
       }
       catch (error) {
            console.error("Error fetching patient queue info:", error.message);
            res.status(500).json({ error: error.message });
    }
}

module.exports = { fetchPatientQueueInfo };