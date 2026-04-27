
const { admin, db } = require("../services/config/firebase");
const { 
    SaveAvailability, 
    getAvailability,
    removeAvailability 
} = require("../services/SetAvailabilityService");

async function setAvailability(req, res) {
    try {
        const { StaffCode, StartTime, EndTime, selectedDates, Available } = req.body;
        console.log("STAFF:", req.params.staffCode);
        console.log("DB:", db);

        if (!StaffCode || !StartTime || !EndTime || !selectedDates || Available === undefined) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const result = await SaveAvailability(
            StaffCode,
            StartTime,
            EndTime,
            selectedDates,
            Available
        );

        res.json(result);
    } catch (error) {
        console.error("Error setting availability:", error);
        res.status(500).json({ error: error.message });
    }
}

async function fetchAvailability(req, res) {
    try {
        const { staffCode } = req.params;

        const availability = await getAvailability(staffCode);

        res.json({ availability });
    } catch (error) {
        console.error("Error fetching availability:", error);
        res.status(500).json({ error: error.message });
    }
}

async function deleteAvailability(req, res) {
    try {
        const { staffCode, date } = req.body;

        const result = await removeAvailability(staffCode, date);

        res.json(result);
    } catch (error) {
        console.error("Error removing availability:", error);
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    setAvailability,
    fetchAvailability,
    deleteAvailability
};