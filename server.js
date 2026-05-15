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
let clinicsRoutes, appointmentRoutes, userRoutes, staffAvailabilityRoutes, adminRoutes, queueRoutes;

try {
  clinicsRoutes = require("./routes/clinics");
  console.log("✓ Clinics routes loaded");
} catch (err) {
  console.error("✗ Error loading clinics routes:", err);
}

try {
  appointmentRoutes = require("./routes/appointments");
  console.log("✓ Appointments routes loaded");
} catch (err) {
  console.error("✗ Error loading appointments routes:", err);
}

try {
  userRoutes = require("./routes/user");
  console.log("✓ User routes loaded");
} catch (err) {
  console.error("✗ Error loading user routes:", err);
}

try {
  staffAvailabilityRoutes = require("./routes/StaffAvailability");
  console.log("✓ Staff availability routes loaded");
} catch (err) {
  console.error("✗ Error loading staff availability routes:", err);
}

try {
  adminRoutes = require("./routes/admin");
  console.log("✓ Admin routes loaded");
} catch (err) {
  console.error("✗ Error loading admin routes:", err);
}

try {
  queueRoutes = require("./routes/Queue");
  console.log("✓ Queue routes loaded");
} catch (err) {
  console.error("✗ Error loading queue routes:", err);
}

if (clinicsRoutes) app.use("/api/clinics", clinicsRoutes);
if (appointmentRoutes) app.use("/api", appointmentRoutes); 
if (userRoutes) app.use("/api/user", userRoutes);
if (staffAvailabilityRoutes) app.use("/api/staff/availability", staffAvailabilityRoutes);
if (adminRoutes) app.use("/api/admin", adminRoutes);
if (queueRoutes) app.use("/api/queue", queueRoutes);

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Debug middleware to log all requests
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
});

// 404 handler
app.use((req, res) => {
    console.log(`404 Not Found: ${req.method} ${req.path}`);
    res.status(404).json({ error: "Not found" });
});

if (process.env.NODE_ENV !== 'test') {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}

module.exports = app;

