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
const { getAvailabilityForDate } = require("./services/firebaseService");
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

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
