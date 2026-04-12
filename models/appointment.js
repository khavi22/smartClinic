// models/appointment.js

class Appointment {
  constructor({ id, patientId, clinicId, date, timeSlot }) {
    this.id = id;

    this.patientId = patientId || null; // add auth later
    this.clinicId = clinicId;

    this.date = date;           // "2026-04-12"
    this.timeSlot = timeSlot;   // "10:00"

    // combine for internal logic
    this.dateTime = new Date(`${date}T${timeSlot}`);

    this.status = "booked"; // booked | cancelled | completed | no-show

    this.createdAt = new Date();
  }
}

module.exports = Appointment;