const express = require("express");
const path = require("path");
const cors = require("cors");

require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.use(express.static(path.join(__dirname, "public")));
app.use(cors());

const clinicsRoutes = require("./routes/clinics");
app.use("/api/clinics", clinicsRoutes);

const appointmentRoutes = require("./routes/appointments");
app.use("/api", appointmentRoutes); 

const userRoutes = require("./routes/user");
app.use("/api/user", userRoutes);

if (process.env.NODE_ENV !== 'test') {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}

app.use(express.static("public"));

const staffAvailabilityRoutes = require("./Routes/StaffAvailability");
app.use("/api/staff/availability", staffAvailabilityRoutes);

module.exports = app;
