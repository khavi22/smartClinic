const { 
    saveAvailability, 
    getAvailability,
    removeAvailability 
} = require("../services/SetAvailabilityService");


async function saveAvailability(req,res){
    try{
        const{StaffCode,StartTime,EndTime,selectedDates,Available} = req.body();

        if(!StaffCode || !StartTime || !EndTime || !selectedDates || !Available){
            return res.status(400).json({error:"Missing required fields"});


        }

        const resulut = await saveAvailability(StaffCode,StartTime,EndTime,selectedDates,Available);
        res.json(resulut);
    }
    catch(error){
        console.error("Error setting availability:", error);
        res.status(500).json({ error: error.message });
    }
}

async function   getAvailability(res,req){
    try{
        const{StaffCode}=req.params;
        const Availability= await  getAvailability(StaffCode);
        res.json(Availability);
    }
    catch(error){
        console.error("Error fetching availability:", error);
        res.status(500).json({ error: error.message });
    }
   
}

async function  removeAvailability(req,res){
    try{
       const{staffCode, date}=req.body;
       const result = await  removeAvailability(staffCode,date);
       res.json(result);
    }
    catch(error){
        console.error("Error removing availability:", error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = {saveAvailability,getAvailability,removeAvailability};