const firebaseService = require("../services/firebaseService");
const emailService = require("../services/emailService");
const {
    getAvailability,
    postAppointment,
    getAppointmentsByPatientId,
    cancelAppointmentController
} = require("../Controllers/appointmentsController");

jest.mock("../services/firebaseService");
jest.mock("../services/emailService");
jest.mock("../services/config/firebase", () => ({
    db: { collection: jest.fn() },
    admin: {
        auth: jest.fn(() => ({
            setCustomUserClaims: jest.fn().mockResolvedValue(),
            deleteUser: jest.fn().mockResolvedValue()
        })),
        firestore: jest.fn().mockReturnValue({
            collection: jest.fn().mockReturnValue({
                doc: jest.fn().mockReturnValue({
                    get: jest.fn().mockResolvedValue({
                        exists: true,
                        data: () => ({
                            patientId: "patient-1",
                            clinicName: "Smart Clinic",
                            clinicAddress: "123 Main Rd",
                            date: "2026-04-20",
                            timeSlot: "09:00 - 10:00"
                        })
                    })
                })
            })
        })
    }
}));

describe("appointmentsController", () => {
    let req;
    let res;
    let consoleErrorSpy;
    let consoleLogSpy;
    let consoleWarnSpy;

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
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        consoleLogSpy   = jest.spyOn(console, "log").mockImplementation(() => {});
        consoleWarnSpy  = jest.spyOn(console, "warn").mockImplementation(() => {});

        // ✅ default mock for admin.firestore used in cancelAppointmentController
        const { admin } = require("../services/config/firebase");
        admin.firestore.mockReturnValue({
            collection: jest.fn().mockReturnValue({
                doc: jest.fn().mockReturnValue({
                    get: jest.fn().mockResolvedValue({
                        exists: true,
                        data: () => ({
                            patientId: "patient-1",
                            clinicName: "Smart Clinic",
                            clinicAddress: "123 Main Rd",
                            date: "2026-04-20",
                            timeSlot: "09:00 - 10:00"
                        })
                    })
                })
            })
        });
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
        consoleWarnSpy.mockRestore();
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
            firebaseService.getAvailabilityForDate.mockResolvedValue(slots);

            await getAvailability(req, res);

            expect(firebaseService.getAvailabilityForDate).toHaveBeenCalledWith("default", "2026-04-19");
            expect(res.json).toHaveBeenCalledWith({
                date: "2026-04-19",
                slots
            });
        });

        it("should return 500 when availability lookup fails", async () => {
            req.query.date   = "2026-04-19";
            req.query.clinicId = "clinic-123";
            firebaseService.getAvailabilityForDate.mockRejectedValue(new Error("Lookup failed"));

            await getAvailability(req, res);

            expect(firebaseService.getAvailabilityForDate).toHaveBeenCalledWith("clinic-123", "2026-04-19");
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
            firebaseService.createAppointment.mockResolvedValue({ id: "appt-1" });
            firebaseService.getPatientProfileById.mockResolvedValue({
                email: "patient@gmail.com",
                fullName: "Sipho Dlamini"
            });
            emailService.sendAppointmentConfirmation.mockResolvedValue({});

            await postAppointment(req, res);

            expect(firebaseService.cancelAppointment).not.toHaveBeenCalled();
            expect(firebaseService.createAppointment).toHaveBeenCalledWith(
                "clinic-1", "2026-04-20", "09:00 - 10:00",
                "patient-1", "Smart Clinic", "123 Main Rd", false
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
            firebaseService.cancelAppointment.mockResolvedValue({ message: "Cancelled" });
            firebaseService.createAppointment.mockResolvedValue({ id: "appt-2" });
            firebaseService.getPatientProfileById.mockResolvedValue({
                email: "patient@gmail.com",
                fullName: "Sipho Dlamini"
            });
            emailService.sendAppointmentConfirmation.mockResolvedValue({});

            await postAppointment(req, res);

            expect(firebaseService.cancelAppointment).toHaveBeenCalledWith("old-1");
            expect(firebaseService.createAppointment).toHaveBeenCalledWith(
                "clinic-1", "2026-04-20", "09:00 - 10:00",
                "patient-1", "Smart Clinic", "123 Main Rd", true
            );
        });

        it("should return 400 when the slot is full and unavailable", async () => {
            req.body = {
                patientId: "patient-1",
                clinicId: "clinic-1",
                date: "2026-04-20",
                timeSlot: "09:00 - 10:00"
            };
            firebaseService.createAppointment.mockRejectedValue(new Error("This slot is full"));

            await postAppointment(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: "This slot is full" });
        });

        it("should return 400 when the patient already has a booking", async () => {
            req.body = {
                patientId: "patient-1",
                clinicId: "clinic-1",
                date: "2026-04-20",
                timeSlot: "09:00 - 10:00"
            };
            firebaseService.createAppointment.mockRejectedValue(
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
            firebaseService.createAppointment.mockRejectedValue(new Error("DB failure"));

            await postAppointment(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                error: "Failed to create appointment. Please try again later."
            });
        });

        it("should send a confirmation email after successful booking", async () => {
            req.body = {
                patientId: "patient-1",
                clinicId: "clinic-1",
                date: "2026-04-20",
                timeSlot: "09:00 - 10:00",
                clinicName: "Smart Clinic",
                clinicAddress: "123 Main Rd"
            };
            firebaseService.createAppointment.mockResolvedValue({ id: "appt-1" });
            firebaseService.getPatientProfileById.mockResolvedValue({
                email: "patient@gmail.com",
                fullName: "Sipho Dlamini"
            });
            emailService.sendAppointmentConfirmation.mockResolvedValue({});

            await postAppointment(req, res);

            expect(emailService.sendAppointmentConfirmation).toHaveBeenCalledWith(
                "patient@gmail.com", "Sipho Dlamini",
                "Smart Clinic", "123 Main Rd",
                "2026-04-20", "09:00 - 10:00", false
            );
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                appointment: { id: "appt-1" }
            });
        });

        it("should send a reschedule email when oldAppointmentId is provided", async () => {
            req.body = {
                patientId: "patient-1",
                clinicId: "clinic-1",
                date: "2026-04-20",
                timeSlot: "09:00 - 10:00",
                clinicName: "Smart Clinic",
                clinicAddress: "123 Main Rd",
                oldAppointmentId: "old-1"
            };
            firebaseService.cancelAppointment.mockResolvedValue({ message: "Cancelled" });
            firebaseService.createAppointment.mockResolvedValue({ id: "appt-2" });
            firebaseService.getPatientProfileById.mockResolvedValue({
                email: "patient@gmail.com",
                fullName: "Sipho Dlamini"
            });
            emailService.sendAppointmentConfirmation.mockResolvedValue({});

            await postAppointment(req, res);

            expect(emailService.sendAppointmentConfirmation).toHaveBeenCalledWith(
                "patient@gmail.com", "Sipho Dlamini",
                "Smart Clinic", "123 Main Rd",
                "2026-04-20", "09:00 - 10:00", true
            );
        });

        it("should still create appointment even if confirmation email fails", async () => {
            req.body = {
                patientId: "patient-1",
                clinicId: "clinic-1",
                date: "2026-04-20",
                timeSlot: "09:00 - 10:00",
                clinicName: "Smart Clinic",
                clinicAddress: "123 Main Rd"
            };
            firebaseService.createAppointment.mockResolvedValue({ id: "appt-1" });
            firebaseService.getPatientProfileById.mockResolvedValue({
                email: "patient@gmail.com",
                fullName: "Sipho Dlamini"
            });
            emailService.sendAppointmentConfirmation.mockRejectedValue(new Error("SMTP error"));

            await postAppointment(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                appointment: { id: "appt-1" }
            });
        });

        it("should not send email if patient has no email address", async () => {
            req.body = {
                patientId: "patient-1",
                clinicId: "clinic-1",
                date: "2026-04-20",
                timeSlot: "09:00 - 10:00",
                clinicName: "Smart Clinic",
                clinicAddress: "123 Main Rd"
            };
            firebaseService.createAppointment.mockResolvedValue({ id: "appt-1" });
            firebaseService.getPatientProfileById.mockResolvedValue({
                fullName: "Sipho Dlamini"
            });

            await postAppointment(req, res);

            expect(emailService.sendAppointmentConfirmation).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                appointment: { id: "appt-1" }
            });
        });
    });

    describe("getAppointmentsByPatientId", () => {
        it("should return 400 if patientId is missing", async () => {
            await getAppointmentsByPatientId(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: "Missing patientId" });
        });

        it("should return appointments for a valid patientId", async () => {
            req.params.patientId = "patient123";
            const mockAppointments = [
                { id: "appt1", patientId: "patient123", doctorId: "doc1", status: "booked" },
                { id: "appt2", patientId: "patient123", doctorId: "doc2", status: "pending" }
            ];
            firebaseService.getAppointmentsByPatientId.mockResolvedValue(mockAppointments);

            await getAppointmentsByPatientId(req, res);

            expect(firebaseService.getAppointmentsByPatientId).toHaveBeenCalledWith("patient123");
            expect(res.json).toHaveBeenCalledWith({ appointments: mockAppointments });
        });

        it("should return 500 if the service throws an error", async () => {
            req.params.patientId = "patient123";
            firebaseService.getAppointmentsByPatientId.mockRejectedValue(new Error("Database error"));

            await getAppointmentsByPatientId(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: "Failed to fetch appointments" });
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
            firebaseService.cancelAppointment.mockResolvedValue({
                message: "Booking cancelled successfully"
            });
            firebaseService.getPatientProfileById.mockResolvedValue({
                email: "patient@gmail.com",
                fullName: "Sipho Dlamini"
            });
            emailService.sendAppointmentCancellation.mockResolvedValue({});

            await cancelAppointmentController(req, res);

            expect(firebaseService.cancelAppointment).toHaveBeenCalledWith("appt-1");
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: "Booking cancelled successfully"
            });
        });

        it("should send a cancellation email after successful cancellation", async () => {
            req.params.id = "appt-1";
            firebaseService.cancelAppointment.mockResolvedValue({
                message: "Booking cancelled successfully"
            });
            firebaseService.getPatientProfileById.mockResolvedValue({
                email: "patient@gmail.com",
                fullName: "Sipho Dlamini"
            });
            emailService.sendAppointmentCancellation.mockResolvedValue({});

            await cancelAppointmentController(req, res);

            expect(emailService.sendAppointmentCancellation).toHaveBeenCalledWith(
                "patient@gmail.com", "Sipho Dlamini",
                "Smart Clinic", "123 Main Rd",
                "2026-04-20", "09:00 - 10:00"
            );
            expect(res.status).toHaveBeenCalledWith(200);
        });

        it("should still cancel appointment even if cancellation email fails", async () => {
            req.params.id = "appt-1";
            firebaseService.cancelAppointment.mockResolvedValue({
                message: "Booking cancelled successfully"
            });
            firebaseService.getPatientProfileById.mockResolvedValue({
                email: "patient@gmail.com",
                fullName: "Sipho Dlamini"
            });
            emailService.sendAppointmentCancellation.mockRejectedValue(new Error("SMTP error"));

            await cancelAppointmentController(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: "Booking cancelled successfully"
            });
        });

        it("should return 500 when cancellation fails", async () => {
            req.params.id = "appt-1";
            firebaseService.cancelAppointment.mockRejectedValue(new Error("Cancel failed"));

            const { admin } = require("../services/config/firebase");
            admin.firestore.mockReturnValue({
                collection: jest.fn().mockReturnValue({
                    doc: jest.fn().mockReturnValue({
                        get: jest.fn().mockResolvedValue({ exists: false })
                    })
                })
            });

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