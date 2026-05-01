const express = require("express");
const path = require("path");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Routes
const clinicsRoutes = require("./routes/clinics");
const appointmentRoutes = require("./routes/appointments");
const userRoutes = require("./routes/user");
const staffAvailabilityRoutes = require("./routes/StaffAvailability");
const adminRoutes = require("./routes/admin");

app.use("/api/clinics", clinicsRoutes);
app.use("/api", appointmentRoutes); 
app.use("/api/user", userRoutes);
app.use("/api/staff/availability", staffAvailabilityRoutes);
app.use("/api/admin", adminRoutes);

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

if (process.env.NODE_ENV !== 'test') {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}

module.exports = app;

