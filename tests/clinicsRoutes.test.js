const request = require("supertest");
const app = require("../server");
const firebaseService = require("../services/firebaseService");
const { admin } = require("../services/config/firebase");

jest.mock("../services/firebaseService");
jest.mock("../services/config/firebase", () => ({
    admin: {
        auth: () => ({
            verifyIdToken: jest.fn().mockResolvedValue({ uid: "admin-uid" })
        })
    },
    db: {
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ adminUid: "admin-uid" }) })
            }))
        }))
    }
}));

describe("Clinics Routes", () => {
    it("POST /api/clinics/ensure-exists should return 200", async () => {
        firebaseService.ensureClinicExists.mockResolvedValue({ success: true });
        const res = await request(app).post("/api/clinics/ensure-exists").send({ clinicId: "c1", name: "N" });
        expect(res.status).toBe(200);
    });

    it("POST /api/clinics/update-hours should return 200 for owner", async () => {
        firebaseService.updateClinicOperatingHours.mockResolvedValue();
        const res = await request(app)
            .post("/api/clinics/update-hours")
            .set("Authorization", "Bearer token")
            .send({ clinicId: "c1", operatingHours: {} });
        expect(res.status).toBe(200);
    });
});
