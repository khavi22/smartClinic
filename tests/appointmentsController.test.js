const appointmentService = require("../services/firebaseService");
const { getAppointmentsByPatientId, getAvailability, postAppointment, cancelAppointmentController } = require("../controllers/appointmentsController");

jest.mock("../services/firebaseService");

describe("getAppointmentsByPatientId controller", () => {
    let req;
    let res;

    beforeEach(() => {
        req = {
            params: {}
        };

        res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        jest.clearAllMocks();
    });

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

describe("getAvailability controller", () => {
    let req;
    let res;

    beforeEach(() => {
        req = {
            query: {}
        };

        res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        jest.clearAllMocks();
    });

    it("should return 400 if date is missing", async () => {
        await getAvailability(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: "Missing date parameter"
        });
    });

    it("should return availability for a valid date and clinicId", async () => {
        req.query.date = "2026-04-20";
        req.query.clinicId = "clinic123";

        const mockSlots = ["09:00", "10:00", "11:00"];

        appointmentService.getAvailabilityForDate.mockResolvedValue(mockSlots);

        await getAvailability(req, res);

        expect(appointmentService.getAvailabilityForDate)
            .toHaveBeenCalledWith("clinic123", "2026-04-20");

        expect(res.json).toHaveBeenCalledWith({
            date: "2026-04-20",
            slots: mockSlots
        });
    });

    it("should use default clinicId if not provided", async () => {
        req.query.date = "2026-04-20";

        const mockSlots = ["09:00", "10:00"];

        appointmentService.getAvailabilityForDate.mockResolvedValue(mockSlots);

        await getAvailability(req, res);

        expect(appointmentService.getAvailabilityForDate)
            .toHaveBeenCalledWith("default", "2026-04-20");

        expect(res.json).toHaveBeenCalledWith({
            date: "2026-04-20",
            slots: mockSlots
        });
    });

    it("should return 500 if the service throws an error", async () => {
        req.query.date = "2026-04-20";
        req.query.clinicId = "clinic123";

        appointmentService.getAvailabilityForDate.mockRejectedValue(
            new Error("Database error")
        );

        await getAvailability(req, res);

        expect(appointmentService.getAvailabilityForDate)
            .toHaveBeenCalledWith("clinic123", "2026-04-20");

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: "Failed to fetch availability data."
        });
    });
});

describe("postAppointment controller", () => {
    let req;
    let res;

    beforeEach(() => {
        req = {
            body: {}
        };

        res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        jest.clearAllMocks();
        jest.spyOn(console, "error").mockImplementation(() => {});
        jest.spyOn(console, "log").mockImplementation(() => {});
    });

    it("should return 400 if date or timeSlot is missing", async () => {
        req.body = {
            patientId: "patient123",
            clinicId: "clinic123"
        };

        await postAppointment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: "Missing date or timeSlot"
        });
    });

    it("should create a new appointment successfully", async () => {
        req.body = {
            patientId: "patient123",
            clinicId: "clinic123",
            date: "2026-04-20",
            timeSlot: "09:00 - 10:00",
            clinicName: "Community Clinic",
            clinicAddress: "123 Main Road"
        };

        const mockAppointment = {
            id: "appt1",
            patientId: "patient123",
            clinicId: "clinic123",
            date: "2026-04-20",
            timeSlot: "09:00 - 10:00"
        };

        appointmentService.createAppointment.mockResolvedValue(mockAppointment);

        await postAppointment(req, res);

        expect(appointmentService.createAppointment).toHaveBeenCalledWith(
            "clinic123",
            "2026-04-20",
            "09:00 - 10:00",
            "patient123",
            "Community Clinic",
            "123 Main Road",
            false
        );

        expect(res.json).toHaveBeenCalledWith({
            success: true,
            appointment: mockAppointment
        });
    });

    it("should cancel old appointment first when rescheduling", async () => {
        req.body = {
            patientId: "patient123",
            clinicId: "clinic123",
            date: "2026-04-20",
            timeSlot: "10:00 - 11:00",
            clinicName: "Community Clinic",
            clinicAddress: "123 Main Road",
            oldAppointmentId: "oldAppt1"
        };

        const mockAppointment = {
            id: "newAppt1",
            patientId: "patient123",
            clinicId: "clinic123",
            date: "2026-04-20",
            timeSlot: "10:00 - 11:00"
        };

        appointmentService.cancelAppointment.mockResolvedValue();
        appointmentService.createAppointment.mockResolvedValue(mockAppointment);

        await postAppointment(req, res);

        expect(appointmentService.cancelAppointment).toHaveBeenCalledWith("oldAppt1");
        expect(appointmentService.createAppointment).toHaveBeenCalledWith(
            "clinic123",
            "2026-04-20",
            "10:00 - 11:00",
            "patient123",
            "Community Clinic",
            "123 Main Road",
            true
        );

        expect(res.json).toHaveBeenCalledWith({
            success: true,
            appointment: mockAppointment
        });
    });

    it("should return 400 if appointment slot is full and unavailable", async () => {
        req.body = {
            patientId: "patient123",
            clinicId: "clinic123",
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

    it("should return 400 if patient already has a booking", async () => {
        req.body = {
            patientId: "patient123",
            clinicId: "clinic123",
            date: "2026-04-20",
            timeSlot: "09:00 - 10:00"
        };

        appointmentService.createAppointment.mockRejectedValue(
            new Error("You already have a booking")
        );

        await postAppointment(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: "You already have a booking"
        });
    });

    it("should return 500 if service throws an unexpected error", async () => {
        req.body = {
            patientId: "patient123",
            clinicId: "clinic123",
            date: "2026-04-20",
            timeSlot: "09:00 - 10:00"
        };

        appointmentService.createAppointment.mockRejectedValue(
            new Error("Database crashed")
        );

        await postAppointment(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: "Failed to create appointment. Please try again later."
        });
    });
});

describe("cancelAppointmentController", () => {
    let req;
    let res;

    beforeEach(() => {
        req = {
            params: {}
        };

        res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        jest.clearAllMocks();
        jest.spyOn(console, "error").mockImplementation(() => {});
    });

    it("should return 400 if appointmentId is missing", async () => {
        await cancelAppointmentController(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "Appointment ID is required"
        });
    });

    it("should cancel appointment successfully", async () => {
        req.params.id = "appt123";

        const mockResult = {
            message: "Appointment cancelled successfully"
        };

        appointmentService.cancelAppointment.mockResolvedValue(mockResult);

        await cancelAppointmentController(req, res);

        expect(appointmentService.cancelAppointment).toHaveBeenCalledWith("appt123");

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            message: "Appointment cancelled successfully"
        });
    });

    it("should return 500 if service throws an error", async () => {
        req.params.id = "appt123";

        appointmentService.cancelAppointment.mockRejectedValue(
            new Error("Database error")
        );

        await cancelAppointmentController(req, res);

        expect(appointmentService.cancelAppointment).toHaveBeenCalledWith("appt123");

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: "Failed to cancel appointment",
            error: "Database error"
        });
    });
});