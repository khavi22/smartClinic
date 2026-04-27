const { 
    SaveAvailability, 
    getAvailability,
    removeAvailability 
}= require("../services/SetAvailabilityService");


async function setAvailability(req, res) {
    try {
        console.log("Request received:", req.body);
        
        const staffCode = "STF-330AFB";
        const { dates, startTime, endTime, available } = req.body;
        
        console.log("STAFF:", staffCode);
        console.log("dates:", dates);
        console.log("startTime:", startTime);
        console.log("endTime:", endTime);

        if(!dates || !startTime || !endTime || available === undefined){
            return res.status(400).json({ error: "Missing required fields" });
        }

        const result = await SaveAvailability(
            staffCode,
            dates,
            startTime,
            endTime,
            available
        );

        res.json(result);

    } catch(error){
        console.error("Error setting availability:", error.message);
        res.status(500).json({ error: error.message });
    }
}

async function fetchAvailability(req, res) {
    try {
        const staffCode = "STF-330AFB";
        console.log("Fetching availability for:", staffCode);

        const availability = await getAvailability(staffCode);
        res.json({ availability });

    } catch(error){
        console.error("Error fetching availability:", error.message);
        res.status(500).json({ error: error.message });
    }
}

async function deleteAvailability(req, res) {
    try {
        const staffCode = "STF-330AFB";
        const { date } = req.body;

        const result = await removeAvailability(staffCode, date);
        res.json(result);

    } catch(error){
        console.error("Error removing availability:", error.message);
        res.status(500).json({ error: error.message });
    }
}

module.exports = { setAvailability, fetchAvailability, deleteAvailability };