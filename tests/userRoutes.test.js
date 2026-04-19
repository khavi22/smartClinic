const request = require("supertest");
const app = require("../server");
const firebaseService = require("../services/firebaseService");
const { admin } = require("../services/config/firebase");

jest.mock("../services/firebaseService");
jest.mock("../services/config/firebase", () => ({
    admin: {
        auth: () => ({
            verifyIdToken: jest.fn().mockResolvedValue({ uid: "test-uid" })
        })
    },
    db: {}
}));

describe("User Routes", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("GET /api/user/login/:userId", () => {
        it("should return 200 and redirect info when user exists", async () => {
            firebaseService.getUserProfileById.mockResolvedValue({ uid: "test-uid", role: "patient" });
            
            const res = await request(app).get("/api/user/login/test-uid");
            
            expect(res.status).toBe(200);
            expect(res.body.exists).toBe(true);
        });
    });

    describe("POST /api/user/register", () => {
        it("should return 201 on successful registration", async () => {
            firebaseService.createUserProfile.mockResolvedValue();
            
            const res = await request(app).post("/api/user/register").send({
                uid: "test-uid",
                fullName: "Test User",
                email: "test@example.com",
                role: "patient",
                phone: "1234567890"
            });
            
            expect(res.status).toBe(201);
        });
    });

    describe("DELETE /api/user/account", () => {
        it("should return 200 on successful deletion", async () => {
            firebaseService.deleteUserAccount.mockResolvedValue();
            
            const res = await request(app)
                .delete("/api/user/account")
                .set("Authorization", "Bearer val-token");
            
            expect(res.status).toBe(200);
        });
    });
});
