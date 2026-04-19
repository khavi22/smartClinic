const request = require("supertest");
const app = require("../server");
const firebaseService = require("../services/firebaseService");

jest.mock("../services/firebaseService");

describe("Appointments Routes", () => {
    it("GET /api/availability should return 200", async () => {
        firebaseService.getAvailabilityForDate.mockResolvedValue([]);
        const res = await request(app).get("/api/availability?date=2026-04-20");
        expect(res.status).toBe(200);
    });

    it("POST /api/appointments should return 200", async () => {
        firebaseService.createAppointment.mockResolvedValue({ id: "a1" });
        const res = await request(app).post("/api/appointments").send({
            patientId: "p1", clinicId: "c1", date: "2026-04-20", timeSlot: "08:00"
        });
        expect(res.status).toBe(200);
    });
});
