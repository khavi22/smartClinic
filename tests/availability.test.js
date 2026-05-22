const { getAvailability } = require("../Controllers/appointmentsController");
const firebaseService = require("../services/firebaseService");

jest.mock("../services/firebaseService");

// Suite: groups related coverage for Availability Logic Tests.
describe("Availability Logic Tests", () => {
    let req, res, consoleErrorSpy;

    // Setup: resets shared mocks and test data before each case in this scope.
    beforeEach(() => {
        process.env.ML_SERVICE_URL = "";
        global.fetch = jest.fn();
        req = { query: {}, body: {}, params: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    // Cleanup: restores mocks so one test cannot leak state into the next.
    afterEach(() => {
        consoleErrorSpy.mockRestore();
        delete global.fetch;
    });

    // Test: checks should return empty slots if the clinic is closed. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

    // Test: checks should correctly handle valid clinics and dates. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

    // Test: checks should fail gracefully on service error. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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
