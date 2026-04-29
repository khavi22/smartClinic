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

const clinicsRoutes = require("./routes/clinics");
app.use("/api/clinics", clinicsRoutes);

const appointmentRoutes = require("./routes/appointments");
app.use("/api", appointmentRoutes); 

const userRoutes = require("./routes/user");
app.use("/api/user", userRoutes);

const adminRoutes = require("./routes/admin");
app.use("/api/admin", adminRoutes);

const queueRoutes = require("./routes/queue");
app.use("/api/queue", queueRoutes);

if (process.env.NODE_ENV !== 'test') {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}

app.use(express.static("public"));

module.exports = app;
