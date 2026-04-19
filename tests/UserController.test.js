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
    createUserProfile,
    deleteUserAccount
} = require("../controllers/UserController");
const firebaseService = require("../services/firebaseService");

jest.mock("../services/firebaseService");

describe("UserController", () => {
    let req;
    let res;

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

        it("should return the dashboard redirect when a user exists by uid", async () => {
            firebaseService.getUserProfileById.mockResolvedValue({
                uid: "test-uid",
                email: "john@example.com",
                role: "patient"
            });

            await checkUserLogin(req, res);

            expect(firebaseService.getUserProfileById).toHaveBeenCalledWith("test-uid");
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                exists: true,
                redirect: "/dashboard.html",
                profile: {
                    uid: "test-uid",
                    email: "john@example.com",
                    role: "patient"
                }
            });
        });

        it("should look up by email when userId is missing", async () => {
            req.params = {};
            req.query.email = "john@example.com";
            firebaseService.getUserProfileByEmail.mockResolvedValue({
                uid: "test-uid",
                email: "john@example.com",
                role: "admin"
            });

            await checkUserLogin(req, res);

            expect(firebaseService.getUserProfileById).not.toHaveBeenCalled();
            expect(firebaseService.getUserProfileByEmail).toHaveBeenCalledWith("john@example.com");
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                exists: true,
                redirect: "/dashboard.html",
                profile: {
                    uid: "test-uid",
                    email: "john@example.com",
                    role: "admin"
                }
            });
        });

        it("should fall back to email lookup when uid is not found", async () => {
            req.query.email = "john@example.com";
            firebaseService.getUserProfileById.mockResolvedValue(null);
            firebaseService.getUserProfileByEmail.mockResolvedValue({
                uid: "test-uid",
                email: "john@example.com",
                role: "admin"
            });

            await checkUserLogin(req, res);

            expect(firebaseService.getUserProfileByEmail).toHaveBeenCalledWith("john@example.com");
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                exists: true,
                redirect: "/dashboard.html",
                profile: {
                    uid: "test-uid",
                    email: "john@example.com",
                    role: "admin"
                }
            });
        });

        it("should return the signup redirect when no profile exists", async () => {
            req.query.email = "john@example.com";
            firebaseService.getUserProfileById.mockResolvedValue(null);
            firebaseService.getUserProfileByEmail.mockResolvedValue(null);

            await checkUserLogin(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                exists: false,
                redirect: "/signUp.html"
            });
        });

        it("should return the signup redirect when userId is provided without an email fallback", async () => {
            req.params.userId = "missing-user";
            req.query = {};
            firebaseService.getUserProfileById.mockResolvedValue(null);

            await checkUserLogin(req, res);

            expect(firebaseService.getUserProfileById).toHaveBeenCalledWith("missing-user");
            expect(firebaseService.getUserProfileByEmail).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                exists: false,
                redirect: "/signUp.html"
            });
        });

        it("should return 500 when login lookup fails", async () => {
            firebaseService.getUserProfileById.mockRejectedValue(new Error("Lookup failed"));

            await checkUserLogin(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                error: "Failed to check user login"
            });
        });
    });

    describe("createUserProfile", () => {
        beforeEach(() => {
            req.body = {
                uid: "test-uid",
                fullName: "John Doe",
                email: "john@example.com",
                role: "patient",
                phone: "1234567890"
            };
        });

        it("should create a patient profile and return 201", async () => {
            firebaseService.createUserProfile.mockResolvedValue();

            await createUserProfile(req, res);

            expect(firebaseService.createUserProfile).toHaveBeenCalledWith({
                uid: "test-uid",
                fullName: "John Doe",
                email: "john@example.com",
                role: "patient",
                phone: "1234567890"
            });
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: "Patient account created successfully",
                profile: {
                    uid: "test-uid",
                    fullName: "John Doe",
                    email: "john@example.com",
                    role: "patient",
                    phone: "1234567890"
                }
            });
        });

        it("should create an admin profile and claim the clinic", async () => {
            req.body.role = "admin";
            req.body.adminCode = "ADM-A1B2C3";

            firebaseService.getClinicIdFromAdminCode.mockResolvedValue("clinic-123");
            firebaseService.createUserProfile.mockResolvedValue();
            firebaseService.claimClinic.mockResolvedValue();

            await createUserProfile(req, res);

            expect(firebaseService.getClinicIdFromAdminCode).toHaveBeenCalledWith("ADM-A1B2C3");
            expect(firebaseService.createUserProfile).toHaveBeenCalledWith(
                {
                    uid: "test-uid",
                    fullName: "John Doe",
                    email: "john@example.com",
                    role: "admin",
                    phone: "1234567890"
                },
                {
                    adminCode: "ADM-A1B2C3",
                    clinicId: "clinic-123"
                }
            );
            expect(firebaseService.claimClinic).toHaveBeenCalledWith("clinic-123");
            expect(res.status).toHaveBeenCalledWith(201);
        });

        it("should return 400 when required fields are missing", async () => {
            req.body = {
                fullName: "John Doe",
                email: "john@example.com"
            };

            await createUserProfile(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Missing required fields"
            });
        });

        it("should return 400 when the role is invalid", async () => {
            req.body.role = "manager";

            await createUserProfile(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Invalid role selected"
            });
        });

        it("should return 400 when admin code is missing", async () => {
            req.body.role = "admin";
            delete req.body.adminCode;

            await createUserProfile(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Admin code is required"
            });
        });

        it("should return 403 when the admin code is invalid", async () => {
            req.body.role = "admin";
            req.body.adminCode = "ADM-INVALID";

            firebaseService.getClinicIdFromAdminCode.mockResolvedValue(null);

            await createUserProfile(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Invalid or already used admin code"
            });
        });

        it("should return 500 when profile creation fails", async () => {
            firebaseService.createUserProfile.mockRejectedValue(new Error("Firebase error"));

            await createUserProfile(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Failed to create user profile",
                error: "Firebase error"
            });
        });
    });

    describe("deleteUserAccount", () => {
        it("should delete the signed-in user account", async () => {
            req.headers.authorization = "Bearer token-123";
            mockVerifyIdToken.mockResolvedValue({ uid: "test-uid" });
            firebaseService.deleteUserAccount.mockResolvedValue();

            await deleteUserAccount(req, res);

            expect(mockVerifyIdToken).toHaveBeenCalledWith("token-123");
            expect(firebaseService.deleteUserAccount).toHaveBeenCalledWith("test-uid");
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: "Account deleted successfully"
            });
        });

        it("should return 401 when the auth header is missing", async () => {
            await deleteUserAccount(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Missing authorization token"
            });
        });

        it("should return 500 when deletion fails", async () => {
            req.headers.authorization = "Bearer token-123";
            mockVerifyIdToken.mockResolvedValue({ uid: "test-uid" });
            firebaseService.deleteUserAccount.mockRejectedValue(new Error("Delete failed"));

            await deleteUserAccount(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Failed to delete user account",
                error: "Delete failed"
            });
        });
    });
});
