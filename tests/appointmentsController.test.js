const appointmentService = require("../services/firebaseService");
const { getAppointmentsByPatientId } = require("../controllers/appointmentsController");

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

