const mockVerifyIdToken = jest.fn();

jest.mock("../services/config/firebase", () => ({
    admin: {
        auth: () => ({
            verifyIdToken: mockVerifyIdToken
        })
    }
}));

const firebaseService = require("../services/firebaseService");
const {
    checkUserLogin,
    registerUser,
    deleteUserAccount
<<<<<<< HEAD
} = require("../Controllers/UserController");
<<<<<<< HEAD
const firebaseService = require("../services/firebaseService");
=======
>>>>>>> 1079774a5eeb2643f2763e3751bbdd6041c6aa4d
=======
} = require("../controllers/UserController");
>>>>>>> clinic-search/Mzo

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
<<<<<<< HEAD
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
=======
        jest.spyOn(console, "error").mockImplementation(() => {});
        jest.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        console.error.mockRestore();
        console.warn.mockRestore();
>>>>>>> clinic-search/Mzo
    });

    describe("checkUserLogin", () => {
        it("returns 400 when both userId and email are missing", async () => {
            req.params = {};
            await checkUserLogin(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: "Missing userId or email" });
        });

        it("returns patient redirect when patient exists", async () => {
            firebaseService.getUserProfileById.mockResolvedValue({
                uid: "test-uid",
                role: "patient"
            });

            await checkUserLogin(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                exists: true,
                redirect: "/dashboard.html",
                profile: {
                    uid: "test-uid",
                    role: "patient"
                }
            });
        });

        it("returns admin redirect and clinic name enrichment", async () => {
            firebaseService.getUserProfileById.mockResolvedValue({
                uid: "test-uid",
                role: "admin",
                clinicId: "clinic-1"
            });
            firebaseService.getClinicNameById.mockResolvedValue("Smart Clinic");

            await checkUserLogin(req, res);

            expect(firebaseService.getClinicNameById).toHaveBeenCalledWith("clinic-1");
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                exists: true,
                redirect: "/adminDashboard.html",
                profile: {
                    uid: "test-uid",
                    role: "admin",
                    clinicId: "clinic-1",
                    clinicName: "Smart Clinic"
                }
            });
        });

        it("falls back to email lookup", async () => {
            req.query.email = "john@example.com";
            firebaseService.getUserProfileById.mockResolvedValue(null);
            firebaseService.getUserProfileByEmail.mockResolvedValue({
                uid: "test-uid",
                role: "staff"
            });

            await checkUserLogin(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                exists: true,
                redirect: "/staffDashboard.html",
                profile: {
                    uid: "test-uid",
                    role: "staff"
                }
            });
        });

        it("returns signup redirect when no matching profile exists", async () => {
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

<<<<<<< HEAD
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
=======
        it("returns signup redirect when found email profile uid does not match", async () => {
            req.query.email = "john@example.com";
            firebaseService.getUserProfileById.mockResolvedValue(null);
            firebaseService.getUserProfileByEmail.mockResolvedValue({
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

        it("returns 500 on lookup failure", async () => {
            firebaseService.getUserProfileById.mockRejectedValue(new Error("DB error"));
>>>>>>> clinic-search/Mzo

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

        it("returns 400 when required fields are missing", async () => {
            req.body = { uid: "test-uid" };

            await registerUser(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Missing required fields"
            });
        });

        it("returns 400 for invalid role", async () => {
            req.body.role = "manager";

            await registerUser(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Invalid role selected"
            });
        });

        it("creates patient profile", async () => {
            firebaseService.createUserProfile.mockResolvedValue();

            await registerUser(req, res);

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
                role: "patient",
                redirect: "/dashboard.html",
                profile: {
                    uid: "test-uid",
                    fullName: "John Doe",
                    email: "john@example.com",
                    role: "patient",
                    phone: "1234567890"
                }
            });
        });

        it("creates admin profile using verificationCode", async () => {
            req.body.role = "admin";
            req.body.verificationCode = "ADM-CODE";
            firebaseService.getClinicIdFromAdminCode.mockResolvedValue("clinic-1");
            firebaseService.createUserProfile.mockResolvedValue();
            firebaseService.claimClinic.mockResolvedValue();

            await registerUser(req, res);

            expect(firebaseService.getClinicIdFromAdminCode).toHaveBeenCalledWith("ADM-CODE");
            expect(firebaseService.createUserProfile).toHaveBeenCalledWith(
                {
                    uid: "test-uid",
                    fullName: "John Doe",
                    email: "john@example.com",
                    role: "admin",
                    phone: "1234567890"
                },
                {
                    adminCode: "ADM-CODE",
                    clinicId: "clinic-1"
                }
            );
            expect(firebaseService.claimClinic).toHaveBeenCalledWith("clinic-1", "test-uid");
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: "Admin account created successfully",
                role: "admin",
                redirect: "/adminDashboard.html",
                profile: {
                    uid: "test-uid",
                    fullName: "John Doe",
                    email: "john@example.com",
                    role: "admin",
                    phone: "1234567890",
                    adminCode: "ADM-CODE",
                    clinicId: "clinic-1"
                }
            });
        });

        it("returns 400 when admin code is missing", async () => {
            req.body.role = "admin";

            await registerUser(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Admin code is required"
            });
        });

        it("returns 403 when admin code is invalid", async () => {
            req.body.role = "admin";
            req.body.adminCode = "ADM-BAD";
            firebaseService.getClinicIdFromAdminCode.mockResolvedValue(null);

            await registerUser(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Invalid or already used admin code"
            });
        });

        it("creates staff profile using verificationCode", async () => {
            req.body.role = "staff";
            req.body.verificationCode = "STF-CODE";
            firebaseService.getStaffAssignmentFromCode.mockResolvedValue("clinic-2");
            firebaseService.createUserProfile.mockResolvedValue();

            await registerUser(req, res);

            expect(firebaseService.getStaffAssignmentFromCode).toHaveBeenCalledWith("STF-CODE");
            expect(firebaseService.createUserProfile).toHaveBeenCalledWith(
                {
                    uid: "test-uid",
                    fullName: "John Doe",
                    email: "john@example.com",
                    role: "staff",
                    phone: "1234567890"
                },
                {
                    staffCode: "STF-CODE",
                    clinicId: "clinic-2"
                }
            );
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: "Staff account created successfully",
                role: "staff",
                redirect: "/staffDashboard.html",
                profile: {
                    uid: "test-uid",
                    fullName: "John Doe",
                    email: "john@example.com",
                    role: "staff",
                    phone: "1234567890",
                    staffCode: "STF-CODE",
                    clinicId: "clinic-2"
                }
            });
        });

        it("returns 400 when staff code is missing", async () => {
            req.body.role = "staff";

            await registerUser(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Staff code is required"
            });
        });

        it("returns 403 when staff code is invalid", async () => {
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

        it("returns 500 on registration error", async () => {
            firebaseService.createUserProfile.mockRejectedValue(new Error("Fail"));

            await registerUser(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Failed to register user",
                error: "Fail"
            });
        });
    });

    describe("deleteUserAccount", () => {
        it("deletes the account successfully", async () => {
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

        it("returns 401 when authorization header is missing", async () => {
            await deleteUserAccount(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Missing authorization token"
            });
        });

        it("returns 500 on delete error", async () => {
            req.headers.authorization = "Bearer token-123";
            mockVerifyIdToken.mockResolvedValue({ uid: "test-uid" });
            firebaseService.deleteUserAccount.mockRejectedValue(new Error("Fail"));

            await deleteUserAccount(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Failed to delete user account",
                error: "Fail"
            });
        });
    });
});
