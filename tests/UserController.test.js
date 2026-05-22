const firebaseService = require("../services/firebaseService");
const { admin } = require("../services/config/firebase");

const mockVerifyIdToken = jest.fn();

jest.mock("../services/config/firebase", () => {
    const mockUpdate = jest.fn().mockResolvedValue({});
    const mockFirestore = jest.fn().mockReturnValue({
        collection: jest.fn().mockReturnValue({
            doc: jest.fn().mockReturnValue({
                update: mockUpdate
            })
        })
    });
    mockFirestore.FieldValue = {
        serverTimestamp: () => "mock-timestamp"
    };

    return {
        admin: {
            auth: () => ({
                verifyIdToken: mockVerifyIdToken
            }),
            firestore: mockFirestore
        }
    };
});

const {
    checkUserLogin,
    registerUser,
    deleteUserAccount
} = require("../Controllers/UserController");

jest.mock("../services/firebaseService");

// Suite: groups related coverage for UserController.
describe("UserController", () => {
    let req;
    let res;
    let consoleErrorSpy;

    // Setup: resets shared mocks and test data before each case in this scope.
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

    // Cleanup: restores mocks so one test cannot leak state into the next.
    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
    });

    // Suite: groups related coverage for checkUserLogin.
    describe("checkUserLogin", () => {
        // Test: checks should return 400 when both userId and email are missing. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return 400 when both userId and email are missing", async () => {
            req.params = {};
            req.query = {};

            await checkUserLogin(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: "Missing userId or email"
            });
        });

        // Test: checks should return the correct redirect when an admin exists. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return the correct redirect when a patient exists. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return signup redirect when no profile exists. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should fall back to email lookup and return staff redirect. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return signup redirect when found profile uid does not match userId. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should handle profile enrichment warnings gracefully. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 500 when an error occurs during check. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return 500 when an error occurs during check", async () => {
            firebaseService.getUserProfileById.mockRejectedValue(new Error("DB Error"));

            await checkUserLogin(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: "Failed to check user login" });
        });
    });

    // Suite: groups related coverage for registerUser.
    describe("registerUser", () => {
        // Setup: resets shared mocks and test data before each case in this scope.
        beforeEach(() => {
            req.body = {
                uid: "test-uid",
                fullName: "John Doe",
                email: "john@example.com",
                role: "patient",
                phone: "1234567890"
            };
        });

        // Test: checks should return 400 when required fields are missing. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return 400 when required fields are missing", async () => {
            req.body = { uid: "test-uid" }; // missing others

            await registerUser(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        // Test: checks should create a patient profile and return 201. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should create a patient profile and return 201", async () => {
            firebaseService.createUserProfile.mockResolvedValue();

            await registerUser(req, res);

            expect(firebaseService.createUserProfile).toHaveBeenCalled();
            expect(res.status).toHaveBeenCalledWith(201);
        });

        // Test: checks should return 400 for an invalid role. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return 400 for an invalid role", async () => {
            req.body.role = "manager";

            await registerUser(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Invalid role selected"
            });
        });

        // Test: checks should return 400 when admin misses verification code. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return 400 when admin misses verification code", async () => {
            req.body.role = "admin";
            await registerUser(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        // Test: checks should create an admin profile using the admin-code fallback lookup. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 403 when an admin is already linked to another clinic. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 403 when admin code is invalid. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 403 for role mismatch. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 403 when clinic already managed. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should create a staff profile when a valid staff code is provided. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should create a staff profile when a valid staff code is provided", async () => {
            req.body.role = "staff";
            req.body.email = "staff@example.com";
            firebaseService.getInviteByEmail.mockResolvedValue({ clinicId: "clinic-555" });
            firebaseService.createUserProfile.mockResolvedValue();

            await registerUser(req, res);

            expect(firebaseService.createUserProfile).toHaveBeenCalledWith(
                expect.objectContaining({ role: "staff" }),
                expect.objectContaining({ clinicId: "clinic-555", approvalStatus: "pending" })
            );
            expect(res.status).toHaveBeenCalledWith(201);
        });

        // Test: checks should return 4-03 when staff code is invalid. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return 4-03 when staff code is invalid", async () => {
            req.body.role = "staff";
            req.body.email = "staff@example.com";
            firebaseService.getInviteByEmail.mockResolvedValue(null);

            await registerUser(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "You must be invited by an administrator to sign up as staff."
            });
        });

        // Test: checks should return 500 on registration error. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return 500 on registration error", async () => {
            firebaseService.createUserProfile.mockRejectedValue(new Error("Fail"));

            await registerUser(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    // Suite: groups related coverage for deleteUserAccount.
    describe("deleteUserAccount", () => {
        // Test: checks should delete the account successfully. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 401 when authorization header is missing. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return 401 when authorization header is missing", async () => {
            req.headers.authorization = "";
            await deleteUserAccount(req, res);
            expect(res.status).toHaveBeenCalledWith(401);
        });

        // Test: checks should return 500 on delete error. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return 500 on delete error", async () => {
            req.headers.authorization = "Bearer token-123";
            mockVerifyIdToken.mockResolvedValue({ uid: "test-uid" });
            firebaseService.deleteUserAccount.mockRejectedValue(new Error("Fail"));

            await deleteUserAccount(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

});
