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
    res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// Routes
const clinicsRoutes = require("./routes/clinics");
app.use("/api/clinics", clinicsRoutes);

const appointmentRoutes = require("./routes/appointments");
app.use("/api", appointmentRoutes); 

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});