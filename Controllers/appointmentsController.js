const Appointment = require('../models/appointment');

// Helper: check if date is in the past
const isPastDate = (date, timeSlot) => {
  const appointmentDateTime = new Date(`${date}T${timeSlot}`);
  const now = new Date();

  return appointmentDateTime < now;
};

// BOOK APPOINTMENT
exports.bookAppointment = (req, res) => {
  const { clinicId, date, timeSlot } = req.body;

  // 1. Validate input
  if (!clinicId || !date || !timeSlot) {
    return res.status(400).json({
      message: "clinicId, date and timeSlot are required"
    });
  }

  // 2. Prevent booking in the past
  if (isPastDate(date, timeSlot)) {
    return res.status(400).json({
      message: "Cannot book an appointment in the past"
    });
  }

  // 3. Prevent double booking
  const existing = appointments.find(a =>
    a.clinicId === clinicId &&
    a.date === date &&
    a.timeSlot === timeSlot &&
    a.status !== "cancelled"
  );

  if (existing) {
    return res.status(400).json({
      message: "Time slot already booked"
    });
  }

  // 4. Create appointment
  const newAppointment = new Appointment({ 
    date,
    timeSlot
  });

  appointments.push(newAppointment);

  return res.status(201).json({
    message: "Appointment booked successfully",
    appointment: newAppointment
  });
};