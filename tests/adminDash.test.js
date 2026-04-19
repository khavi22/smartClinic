const request = require("supertest");
const app = require("../server");
const firebaseService = require("../services/firebaseService");
const { admin, db } = require("../services/config/firebase");

jest.mock("../services/firebaseService");
jest.mock("../services/config/firebase", () => ({
    admin: {
        auth: () => ({
            verifyIdToken: jest.fn().mockResolvedValue({ uid: "admin-uid" })
        })
    },
    db: {
        collection: jest.fn()
    }
}));

describe("Admin Dashboard Integration Tests", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    describe("GET /api/user/login/:uid (Admin Path)", () => {
        it("should enrich admin profile with clinic name", async () => {
            const mockProfile = {
                uid: "admin-uid",
                role: "admin",
                clinicId: "clinic-123"
            };

            firebaseService.getUserProfileById.mockResolvedValue(mockProfile);
            firebaseService.getClinicNameById.mockResolvedValue("Healthy Life Clinic");

            const res = await request(app).get("/api/user/login/admin-uid");

            expect(res.status).toBe(200);
            expect(res.body.exists).toBe(true);
            expect(res.body.profile.clinicName).toBe("Healthy Life Clinic");
            expect(res.body.redirect).toBe("/adminDashboard.html");
        });

        it("should handle missing clinic names gracefully during enrichment", async () => {
            const mockProfile = {
                uid: "admin-uid",
                role: "admin",
                clinicId: "missing-clinic"
            };

            firebaseService.getUserProfileById.mockResolvedValue(mockProfile);
            firebaseService.getClinicNameById.mockRejectedValue(new Error("Not found"));

            const res = await request(app).get("/api/user/login/admin-uid");

            expect(res.status).toBe(200);
            expect(res.body.profile.clinicName).toBeUndefined(); // Still works, just no name
        });
    });

    describe("POST /api/clinics/hours (Admin Ownership)", () => {
        it("should block non-admins or non-owners", async () => {
            db.collection.mockReturnValue({
                doc: jest.fn().mockReturnValue({
                    get: jest.fn().mockResolvedValue({ 
                        exists: true, 
                        data: () => ({ adminUid: "OTHER-UID" }) 
                    })
                })
            });

            const res = await request(app)
                .post("/api/clinics/update-hours")
                .set("Authorization", "Bearer mock-token")
                .send({ clinicId: "c1", operatingHours: {} });

            expect(res.status).toBe(403); // Forbidden
            expect(res.body.message).toContain("permission to manage this clinic");
        });
    });
});
