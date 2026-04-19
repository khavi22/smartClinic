const appointmentService = require("../services/firebaseService");
const {
    getAvailability,
    postAppointment,
    getAppointmentsByPatientId,
    cancelAppointmentController
} = require("../controllers/appointmentsController");

jest.mock("../services/firebaseService");

describe("appointmentsController", () => {
    let req;
    let res;

    beforeEach(() => {
        req = {
            query: {},
            body: {},
            params: {}
        };

        res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        jest.clearAllMocks();
    });

    describe("getAvailability", () => {
        it("should return 400 when the date is missing", async () => {
            await getAvailability(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: "Missing date parameter"
            });
        });

        it("should fetch availability with the default clinic id", async () => {
            req.query.date = "2026-04-19";
            const slots = [{ id: 1, time: "01:00 - 02:00" }];
            appointmentService.getAvailabilityForDate.mockResolvedValue(slots);

            await getAvailability(req, res);

            expect(appointmentService.getAvailabilityForDate).toHaveBeenCalledWith("default", "2026-04-19");
            expect(res.json).toHaveBeenCalledWith({
                date: "2026-04-19",
                slots
            });
        });

        it("should return 500 when availability lookup fails", async () => {
            req.query.date = "2026-04-19";
            req.query.clinicId = "clinic-123";
            appointmentService.getAvailabilityForDate.mockRejectedValue(new Error("Lookup failed"));

            await getAvailability(req, res);

            expect(appointmentService.getAvailabilityForDate).toHaveBeenCalledWith("clinic-123", "2026-04-19");
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                error: "Failed to fetch availability data."
            });
        });
    });

    describe("postAppointment", () => {
        it("should return 400 when date or timeSlot is missing", async () => {
            req.body = { patientId: "patient-1" };

            await postAppointment(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: "Missing date or timeSlot"
            });
        });

        it("should create a normal appointment", async () => {
            req.body = {
                patientId: "patient-1",
                clinicId: "clinic-1",
                date: "2026-04-20",
                timeSlot: "09:00 - 10:00",
                clinicName: "Smart Clinic",
                clinicAddress: "123 Main Rd"
            };
            appointmentService.createAppointment.mockResolvedValue({ id: "appt-1" });

            await postAppointment(req, res);

            expect(appointmentService.cancelAppointment).not.toHaveBeenCalled();
            expect(appointmentService.createAppointment).toHaveBeenCalledWith(
                "clinic-1",
                "2026-04-20",
                "09:00 - 10:00",
                "patient-1",
                "Smart Clinic",
                "123 Main Rd",
                false
            );
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                appointment: { id: "appt-1" }
            });
        });

        it("should cancel the old appointment during a reschedule", async () => {
            req.body = {
                patientId: "patient-1",
                clinicId: "clinic-1",
                date: "2026-04-20",
                timeSlot: "09:00 - 10:00",
                clinicName: "Smart Clinic",
                clinicAddress: "123 Main Rd",
                oldAppointmentId: "old-1"
            };
            appointmentService.cancelAppointment.mockResolvedValue({ message: "Cancelled" });
            appointmentService.createAppointment.mockResolvedValue({ id: "appt-2" });

            await postAppointment(req, res);

            expect(appointmentService.cancelAppointment).toHaveBeenCalledWith("old-1");
            expect(appointmentService.createAppointment).toHaveBeenCalledWith(
                "clinic-1",
                "2026-04-20",
                "09:00 - 10:00",
                "patient-1",
                "Smart Clinic",
                "123 Main Rd",
                true
            );
        });

        it("should return 400 when the slot is full and unavailable", async () => {
            req.body = {
                patientId: "patient-1",
                clinicId: "clinic-1",
                date: "2026-04-20",
                timeSlot: "09:00 - 10:00"
            };
            appointmentService.createAppointment.mockRejectedValue(
                new Error("This slot is full and unavailable")
            );

            await postAppointment(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: "This slot is full and unavailable"
            });
        });

        it("should return 400 when the patient already has a booking", async () => {
            req.body = {
                patientId: "patient-1",
                clinicId: "clinic-1",
                date: "2026-04-20",
                timeSlot: "09:00 - 10:00"
            };
            appointmentService.createAppointment.mockRejectedValue(
                new Error("You already have a booking for this day.")
            );

            await postAppointment(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: "You already have a booking for this day."
            });
        });

        it("should return 500 for unexpected appointment creation errors", async () => {
            req.body = {
                patientId: "patient-1",
                clinicId: "clinic-1",
                date: "2026-04-20",
                timeSlot: "09:00 - 10:00"
            };
            appointmentService.createAppointment.mockRejectedValue(new Error("DB failure"));

            await postAppointment(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                error: "Failed to create appointment. Please try again later."
            });
        });
    });

    describe("getAppointmentsByPatientId", () => {
        it("should return 400 if patientId is missing", async () => {
            await getAppointmentsByPatientId(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: "Missing patientId"
            });
        });

        it("should return appointments for a valid patientId", async () => {
            req.params.patientId = "patient123";

            const mockAppointments = [
                {
                    id: "appt1",
                    patientId: "patient123",
                    doctorId: "doc1",
                    status: "booked"
                },
                {
                    id: "appt2",
                    patientId: "patient123",
                    doctorId: "doc2",
                    status: "pending"
                }
            ];

            appointmentService.getAppointmentsByPatientId.mockResolvedValue(mockAppointments);

            await getAppointmentsByPatientId(req, res);

            expect(appointmentService.getAppointmentsByPatientId).toHaveBeenCalledWith("patient123");
            expect(res.json).toHaveBeenCalledWith({
                appointments: mockAppointments
            });
        });

        it("should return 500 if the service throws an error", async () => {
            req.params.patientId = "patient123";

            appointmentService.getAppointmentsByPatientId.mockRejectedValue(
                new Error("Database error")
            );

            await getAppointmentsByPatientId(req, res);

            expect(appointmentService.getAppointmentsByPatientId).toHaveBeenCalledWith("patient123");
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                error: "Failed to fetch appointments"
            });
        });
    });

    describe("cancelAppointmentController", () => {
        it("should return 400 when appointment id is missing", async () => {
            await cancelAppointmentController(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Appointment ID is required"
            });
        });

        it("should cancel an appointment successfully", async () => {
            req.params.id = "appt-1";
            appointmentService.cancelAppointment.mockResolvedValue({
                message: "Booking cancelled successfully"
            });

            await cancelAppointmentController(req, res);

            expect(appointmentService.cancelAppointment).toHaveBeenCalledWith("appt-1");
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: "Booking cancelled successfully"
            });
        });

        it("should return 500 when cancellation fails", async () => {
            req.params.id = "appt-1";
            appointmentService.cancelAppointment.mockRejectedValue(new Error("Cancel failed"));

            await cancelAppointmentController(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Failed to cancel appointment",
                error: "Cancel failed"
            });
        });
    });
});
