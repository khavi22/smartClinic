const { 
    SaveAvailability, 
    getAvailability,
    removeAvailability,
    getClinicName
}= require("../services/SetAvailabilityService");


// POST /api/staff/availability/set
// Saves one staff member's availability for the selected dates and time range.
async function setAvailability(req,res) {
    try {
        
        // const staffCode = "STF-330AFB";
        // const staffCode="J96HrT5YN3VOAAzNGqEhpxj4vUx2";
        const {staffCode,dates, startTime, endTime, available } = req.body;
       
        if(!dates || !startTime || !endTime || available === undefined){
            return res.status(400).json({ error: "Missing required fields" });
        }

        const result = await SaveAvailability(
            staffCode,     // 1. StaffCode
            startTime,     // 2. StartTime (changed from dates)
            endTime,       // 3. EndTime (changed from startTime)
            dates,         // 4. selectedDates (changed from endTime)
            available 
        );

        res.json(result);

    } catch(error){
        console.error("Error setting availability:", error.message);
        res.status(500).json({ error: error.message });
    }
}

// GET /api/staff/availability/:staffCode
// Loads the saved availability map for a staff member.
async function fetchAvailability(req, res) {
    try {
        // const staffCode = "STF-330AFB";
        // const staffCode="J96HrT5YN3VOAAzNGqEhpxj4vUx2";
        const staffCode = req.params.staffCode;
        const availability = await getAvailability(staffCode);
        res.json({ availability });

    } catch(error){
        console.error("Error fetching availability:", error.message);
        res.status(500).json({ error: error.message });
    }
}

// DELETE /api/staff/availability/remove
// Removes one date entry from a staff member's availability map.
async function deleteAvailability(req, res) {
    try {
        // const staffCode = "STF-330AFB";
        // const staffCode="J96HrT5YN3VOAAzNGqEhpxj4vUx2";

       const {staffCode, date } = req.body;

        const result = await removeAvailability(staffCode, date);
        res.json(result);

    } catch(error){
        console.error("Error removing availability:", error.message);
        res.status(500).json({ error: error.message });
    }
}

// GET /api/staff/availability/staff/clinic/:uid
// Finds the clinic name connected to a staff profile so the UI can display it.
async function fetchClinicName(req, res) {
    try {
        const staffCode = req.params.uid;
        const clinicName = await getClinicName(staffCode);

        if (!clinicName) {
            return res.status(404).json({ error: "Clinic not found" });
        }

        res.json({ clinicName });

    } catch (error) {
        console.error("Error fetching clinic name:", error.message);
        res.status(500).json({ error: error.message });
    }
}

module.exports = { setAvailability, fetchAvailability, deleteAvailability,fetchClinicName};

// module.exports = { setAvailability, fetchAvailability, deleteAvailability };
