const firebaseService = require("../services/firebaseService");
const { admin } = require("../services/config/firebase");

const mockVerifyIdToken = jest.fn();
jest.mock("../services/config/firebase", () => ({
    admin: {
        auth: () => ({
            verifyIdToken: mockVerifyIdToken
        })
    }
}));

const {
    checkUserLogin,
    registerUser,
    deleteUserAccount
} = require("../Controllers/UserController");

jest.mock("../services/firebaseService");

describe("UserController", () => {
    let req;
    let res;
    let consoleErrorSpy;

    beforeEach(() => {
        req = {
            params: { userId: "test-uid" },
            query: {},
            body: {},
            headers: {}
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    describe("checkUserLogin", () => {
        it("should return 400 when both userId and email are missing", async () => {
            req.params = {};
            req.query = {};

            await checkUserLogin(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: "Missing userId or email"
            });
        });

        it("should return the correct redirect when an admin exists", async () => {
            firebaseService.getUserProfileById.mockResolvedValue({
                uid: "test-uid",
                role: "admin"
            });

            await checkUserLogin(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                exists: true,
                redirect: "/adminDashboard.html"
            }));
        });

        it("should return the correct redirect when a patient exists", async () => {
            firebaseService.getUserProfileById.mockResolvedValue({
                uid: "test-uid",
                role: "patient"
            });

            await checkUserLogin(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                exists: true,
                redirect: "/dashboard.html"
            }));
        });

        it("should return signup redirect when no profile exists", async () => {
            firebaseService.getUserProfileById.mockResolvedValue(null);
            firebaseService.getUserProfileByEmail.mockResolvedValue(null);

            await checkUserLogin(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                exists: false,
                redirect: "/signUp.html"
            });
        });

        it("should fall back to email lookup and return staff redirect", async () => {
            req.params = {};
            req.query = { email: "staff@example.com" };
            firebaseService.getUserProfileByEmail.mockResolvedValue({
                uid: "staff-uid",
                role: "staff"
            });

            await checkUserLogin(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                exists: true,
                redirect: "/staffDashboard.html"
            }));
        });

        it("should return signup redirect when found profile uid does not match userId", async () => {
            firebaseService.getUserProfileById.mockResolvedValue({
                uid: "another-uid",
                role: "patient"
            });

            await checkUserLogin(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                exists: false,
                redirect: "/signUp.html"
            });
        });

        it("should handle profile enrichment warnings gracefully", async () => {
            // Mock a user that needs enrichment
            firebaseService.getUserProfileById.mockResolvedValueOnce({
                uid: "test-uid",
                role: "staff",
                clinicId: "clinic-123"
            });
            // Force the enrichment to fail
            firebaseService.getClinicNameById.mockRejectedValueOnce(new Error("Enrichment Fail"));
            
            await checkUserLogin(req, res);
            
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ exists: true }));
            expect(consoleWarnSpy).toHaveBeenCalled();
        });

        it("should return 500 when an error occurs during check", async () => {
            firebaseService.getUserProfileById.mockRejectedValue(new Error("DB Error"));

            await checkUserLogin(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: "Failed to check user login" });
        });
    });

    describe("registerUser", () => {
        beforeEach(() => {
            req.body = {
                uid: "test-uid",
                fullName: "John Doe",
                email: "john@example.com",
                role: "patient",
                phone: "1234567890"
            };
        });

        it("should return 400 when required fields are missing", async () => {
            req.body = { uid: "test-uid" }; // missing others

            await registerUser(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it("should create a patient profile and return 201", async () => {
            firebaseService.createUserProfile.mockResolvedValue();

            await registerUser(req, res);

            expect(firebaseService.createUserProfile).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(201);
        });

        it("should return 400 for an invalid role", async () => {
            req.body.role = "manager";

            await registerUser(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Invalid role selected"
            });
        });

        it("should return 400 when admin misses verification code", async () => {
            req.body.role = "admin";
            await registerUser(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it("should create an admin profile using the admin-code fallback lookup", async () => {
            req.body.role = "admin";
            req.body.adminCode = "ADM-CODE";
            firebaseService.getClinicIdFromVerificationCode.mockResolvedValue(null);
            firebaseService.getClinicIdFromAdminCode.mockResolvedValue("clinic-123");
            firebaseService.getUserProfileById.mockResolvedValue(null);
            firebaseService.createUserProfile.mockResolvedValue();
            firebaseService.claimClinic.mockResolvedValue();

            await registerUser(req, res);

            expect(firebaseService.getClinicIdFromAdminCode).toHaveBeenCalledWith("ADM-CODE");
            expect(firebaseService.createUserProfile).toHaveBeenCalledWith(
                expect.objectContaining({ role: "admin" }),
                { adminCode: "ADM-CODE", clinicId: "clinic-123" }
            );
            expect(firebaseService.claimClinic).toHaveBeenCalledWith("clinic-123", "test-uid");
            expect(res.status).toHaveBeenCalledWith(201);
        });

        it("should return 403 when an admin is already linked to another clinic", async () => {
            req.body.role = "admin";
            req.body.verificationCode = "ADM-NEW";

            firebaseService.getClinicIdFromVerificationCode.mockResolvedValue({
                clinicId: "clinic-NEW",
                role: "admin"
            });
            firebaseService.getUserProfileById.mockResolvedValue({
                uid: "test-uid",
                role: "admin",
                clinicId: "clinic-OLD"
            });

            await registerUser(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.stringContaining("already registered")
            }));
        });

        it("should return 403 when admin code is invalid", async () => {
            req.body.role = "admin";
            req.body.verificationCode = "ADM-BAD";
            firebaseService.getClinicIdFromVerificationCode.mockResolvedValue(null);
            firebaseService.getClinicIdFromAdminCode.mockResolvedValue(null);

            await registerUser(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Invalid or already used admin code"
            });
        });

        it("should return 403 for role mismatch", async () => {
            req.body.role = "admin";
            req.body.verificationCode = "STF-CODE";

            firebaseService.getClinicIdFromVerificationCode.mockResolvedValue({
                clinicId: "clinic-123",
                role: "staff" // mismatch
            });

            await registerUser(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });

        it("should return 403 when clinic already managed", async () => {
            req.body.role = "admin";
            req.body.verificationCode = "ADM-CODE";

            firebaseService.getClinicIdFromVerificationCode.mockResolvedValue({
                clinicId: "clinic-123",
                role: "admin",
                adminUid: "OTHER-UID"
            });

            await registerUser(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
        });

        it("should create a staff profile when a valid staff code is provided", async () => {
            req.body.role = "staff";
            req.body.staffCode = "STF-123";
            firebaseService.getStaffAssignmentFromCode.mockResolvedValue("clinic-555");
            firebaseService.createUserProfile.mockResolvedValue();

            await registerUser(req, res);

            expect(firebaseService.createUserProfile).toHaveBeenCalledWith(
                expect.objectContaining({ role: "staff" }),
                { staffCode: "STF-123", clinicId: "clinic-555" }
            );
            expect(res.status).toHaveBeenCalledWith(201);
        });

        it("should return 4-03 when staff code is invalid", async () => {
            req.body.role = "staff";
            req.body.staffCode = "STF-BAD";
            firebaseService.getStaffAssignmentFromCode.mockResolvedValue(null);

            await registerUser(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Invalid staff code"
            });
        });

        it("should return 500 on registration error", async () => {
            firebaseService.createUserProfile.mockRejectedValue(new Error("Fail"));

            await registerUser(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe("deleteUserAccount", () => {
        it("should delete the account successfully", async () => {
            req.headers.authorization = "Bearer token-123";
            mockVerifyIdToken.mockResolvedValue({ uid: "test-uid" });
            firebaseService.deleteUserAccount.mockResolvedValue();

            await deleteUserAccount(req, res);

            expect(firebaseService.deleteUserAccount).toHaveBeenCalledWith("test-uid");
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: "Account deleted successfully"
            });
        });

        it("should return 401 when authorization header is missing", async () => {
            req.headers.authorization = "";
            await deleteUserAccount(req, res);
            expect(res.status).toHaveBeenCalledWith(401);
        });

        it("should return 500 on delete error", async () => {
            req.headers.authorization = "Bearer token-123";
            mockVerifyIdToken.mockResolvedValue({ uid: "test-uid" });
            firebaseService.deleteUserAccount.mockRejectedValue(new Error("Fail"));

            await deleteUserAccount(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

});
