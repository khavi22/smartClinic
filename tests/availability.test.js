const { getAvailability } = require("../controllers/appointmentsController");
const firebaseService = require("../services/firebaseService");

jest.mock("../services/firebaseService");

describe("Availability Logic Tests", () => {
    let req, res, consoleErrorSpy;

    beforeEach(() => {
        req = { query: {}, body: {}, params: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it("should return empty slots if the clinic is closed", async () => {
        req.query.date = "2026-04-19"; // Sunday
        req.query.clinicId = "closed-clinic";
        
        firebaseService.getAvailabilityForDate.mockResolvedValue([]);
        
        await getAvailability(req, res);
        
        expect(res.json).toHaveBeenCalledWith({
            date: "2026-04-19",
            slots: []
        });
    });

    it("should correctly handle valid clinics and dates", async () => {
        req.query.date = "2026-04-20"; // Monday
        req.query.clinicId = "open-clinic";
        
        const mockSlots = [{ time: "09:00 - 10:00", available: true }];
        firebaseService.getAvailabilityForDate.mockResolvedValue(mockSlots);
        
        await getAvailability(req, res);
        
        expect(res.json).toHaveBeenCalledWith({
            date: "2026-04-20",
            slots: mockSlots
        });
    });

    it("should fail gracefully on service error", async () => {
        req.query.date = "2026-04-20";
        firebaseService.getAvailabilityForDate.mockRejectedValue(new Error("Firebase Fail"));
        
        await getAvailability(req, res);
        
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            error: "Failed to fetch availability data."
        });
    });
});
