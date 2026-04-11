const express = require("express");
const path = require("path");
const cors = require("cors");



const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(cors());

require("dotenv").config();
const clinicsRoutes = require("./routes/clinics");
app.use("/api/clinics", clinicsRoutes);

// Setup availability route hooked to our Firebase backend
const { getAvailabilityForDate, createBooking } = require("./services/firebaseService");
app.use(express.json()); // Allows parsing of application/json POST bodies

app.get("/api/availability", async (req, res) => {
    try {
        const dateObj = req.query.date;
        const clinicId = req.query.clinicId || "default";

        if (!dateObj) return res.status(400).json({ error: "Missing date parameter" });

        const slots = await getAvailabilityForDate(clinicId, dateObj);
        res.json({ date: dateObj, slots });
    } catch (error) {
        console.error("Failed to get availability:", error);
        res.status(500).json({ error: "Failed to fetch availability data." });
    }
});

// Create Booking Route
app.post("/api/bookings", async (req, res) => {
    try {
        const { clinicId, date, timeSlot } = req.body;

        if (!date || !timeSlot) {
            return res.status(400).json({ error: "Missing date or timeSlot" });
        }


        // getting patient id from google auth
        //  const token = req.headers.authorization;
        // const decodedToken = await admin.auth().verifyIdToken(token);
        // let patientId = decodedToken.uid;


        // demo id
        let patientId = "demo_patient_123";

        const newBooking = await createBooking(clinicId, date, timeSlot, patientId);
        res.json({ success: true, booking: newBooking });
    } catch (error) {
        console.error("Failed to create booking:", error);

        // Handle validation errors (Slot full or Duplicate booking)
        if (error.message.includes("full and unavailable") ||
            error.message.includes("already have a booking")) {
            return res.status(400).json({ error: error.message });
        }

        res.status(500).json({ error: "Failed to create booking. Please try again later." });
    }
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
