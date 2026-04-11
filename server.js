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

// use the routes instead
const bookingRoutes = require("./routes/bookings");
app.use(express.json()); // Allows parsing of application/json POST bodies
app.use("/api", bookingRoutes);


app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
