const express = require("express");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

require("dotenv").config();
//Routes
//clinic
const clinicsRoutes = require("./routes/clinics");
app.use("/api/clinics", clinicsRoutes);
//appointments
const appointmentRoutes = require('./routes/appointments');
app.use('/appointments', appointmentRoutes);



app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});