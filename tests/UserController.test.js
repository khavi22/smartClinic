const firebaseService = require("../services/firebaseService");
const { 
    checkUserLogin, 
    createPatientProfileController,
    createAdminProfile 
} = require("../controllers/UserController");

jest.mock("../services/firebaseService");

describe("UserController Tests", () => {
    let req;
    let res;

    beforeEach(() => {
        req = {
            params: {},
            body: {}
        };

        res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        jest.clearAllMocks();
        jest.spyOn(console, "error").mockImplementation(() => {});
    });

    describe("checkUserLogin controller", () => {
        it("should return 400 if userId is missing", async () => {
            await checkUserLogin(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: "Missing userId"
            });
        });

        it("should return adminDashboard redirect if user is admin", async () => {
            req.params.userId = "user123";

            const mockUser = {
                uid: "user123",
                role: "admin"
            };

            firebaseService.getUserProfileById.mockResolvedValue(mockUser);

            await checkUserLogin(req, res);

            expect(firebaseService.getUserProfileById).toHaveBeenCalledWith("user123");
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                exists: true,
                redirect: "/adminDashboard.html"
            });
        });

        it("should return dashboard redirect if user is patient", async () => {
            req.params.userId = "user456";

            const mockUser = {
                uid: "user456",
                role: "patient"
            };

            firebaseService.getUserProfileById.mockResolvedValue(mockUser);

            await checkUserLogin(req, res);

            expect(firebaseService.getUserProfileById).toHaveBeenCalledWith("user456");
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                exists: true,
                redirect: "/dashboard.html"
            });
        });

        it("should return signup redirect if user does not exist", async () => {
            req.params.userId = "user999";

            firebaseService.getUserProfileById.mockResolvedValue(null);

            await checkUserLogin(req, res);

            expect(firebaseService.getUserProfileById).toHaveBeenCalledWith("user999");
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                exists: false,
                redirect: "/signUp.html"
            });
        });

        it("should return 500 if service throws an error", async () => {
            req.params.userId = "user123";

            firebaseService.getUserProfileById.mockRejectedValue(
                new Error("Database error")
            );

            await checkUserLogin(req, res);

            expect(firebaseService.getUserProfileById).toHaveBeenCalledWith("user123");
            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                error: "Failed to check user login"
            });
        });
    });

    describe("createPatientProfileController", () => {
        it("should return 400 if required fields are missing", async () => {
            req.body = {
                uid: "user123",
                fullName: "Martin"
            };

            await createPatientProfileController(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Missing required fields"
            });
        });

        it("should create patient record successfully", async () => {
            req.body = {
                uid: "user123",
                fullName: "Martin Mulweli",
                email: "martin@example.com",
                role: "patient",
                phone: "0712345678",
                idNumber: "1234567890123"
            };

            firebaseService.createPatientProfile.mockResolvedValue({
                uid: "user123"
            });

            await createPatientProfileController(req, res);

            expect(firebaseService.createPatientProfile).toHaveBeenCalledWith(
                "user123",
                "Martin Mulweli",
                "martin@example.com",
                "patient",
                "0712345678",
                "1234567890123"
            );

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: "Patient record created successfully"
            });
        });

        it("should create patient record successfully with missing idNumber", async () => {
            req.body = {
                uid: "user123",
                fullName: "Martin Mulweli",
                email: "martin@example.com",
                role: "patient",
                phone: "0712345678"
            };

            firebaseService.createPatientProfile.mockResolvedValue({
                uid: "user123"
            });

            await createPatientProfileController(req, res);

            expect(firebaseService.createPatientProfile).toHaveBeenCalledWith(
                "user123",
                "Martin Mulweli",
                "martin@example.com",
                "patient",
                "0712345678",
                undefined
            );

            expect(res.status).toHaveBeenCalledWith(201);
        });

        it("should return 500 if service throws an error", async () => {
            req.body = {
                uid: "user123",
                fullName: "Martin Mulweli",
                email: "martin@example.com",
                role: "patient",
                phone: "0712345678"
            };

            firebaseService.createPatientProfile.mockRejectedValue(
                new Error("Database error")
            );

            await createPatientProfileController(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Failed to create patient record",
                error: "Database error"
            });
        });
    });

    describe('createAdminProfile - Controller', () => {
        beforeEach(() => {
            req.body = {
                uid: 'test-uid',
                fullName: 'John Doe',
                email: 'john@example.com',
                phone: '1234567890',
                adminCode: 'ADM-A1B2C3'
            };
        });

        describe('Success cases', () => {
            it('should create an admin profile and return 201', async () => {
                firebaseService.getClinicIdFromAdminCode.mockResolvedValue('clinic-123');
                firebaseService.createUserProfile.mockResolvedValue();
                firebaseService.claimClinic.mockResolvedValue();

                await createAdminProfile(req, res);

                expect(firebaseService.getClinicIdFromAdminCode).toHaveBeenCalledWith('ADM-A1B2C3');
                expect(firebaseService.createUserProfile).toHaveBeenCalledWith(
                    { uid: 'test-uid', fullName: 'John Doe', email: 'john@example.com', phone: '1234567890', role: 'admin' },
                    { adminCode: 'ADM-A1B2C3', clinicId: 'clinic-123' }
                );
                expect(firebaseService.claimClinic).toHaveBeenCalledWith('clinic-123', 'test-uid');
                expect(res.status).toHaveBeenCalledWith(201);
                expect(res.json).toHaveBeenCalledWith({
                    success: true,
                    message: 'Admin account created successfully'
                });
            });
        });

        describe('Validation cases', () => {
            it.each([
                ['uid',       { fullName: 'John', email: 'j@j.com', phone: '123', adminCode: 'ADM-ABC' }],
                ['fullName',  { uid: '1',         email: 'j@j.com', phone: '123', adminCode: 'ADM-ABC' }],
                ['email',     { uid: '1',         fullName: 'John',  phone: '123', adminCode: 'ADM-ABC' }],
                ['phone',     { uid: '1',         fullName: 'John',  email: 'j@j.com', adminCode: 'ADM-ABC' }],
                ['adminCode', { uid: '1',         fullName: 'John',  email: 'j@j.com', phone: '123' }]
            ])('should return 400 when %s is missing', async (missingField, body) => {
                req.body = body;

                await createAdminProfile(req, res);

                expect(res.status).toHaveBeenCalledWith(400);
                expect(res.json).toHaveBeenCalledWith({
                    success: false,
                    message: 'Missing required fields'
                });
                expect(firebaseService.getClinicIdFromAdminCode).not.toHaveBeenCalled();
                expect(firebaseService.createUserProfile).not.toHaveBeenCalled();
                expect(firebaseService.claimClinic).not.toHaveBeenCalled();
            });
        });

        describe('Authorization cases', () => {
            it('should return 403 when admin code is invalid', async () => {
                firebaseService.getClinicIdFromAdminCode.mockResolvedValue(null);

                await createAdminProfile(req, res);

                expect(res.status).toHaveBeenCalledWith(403);
                expect(res.json).toHaveBeenCalledWith({
                    success: false,
                    message: 'Invalid or already used admin code'
                });
                expect(firebaseService.createUserProfile).not.toHaveBeenCalled();
                expect(firebaseService.claimClinic).not.toHaveBeenCalled();
            });
        });

        describe('Error cases', () => {
            it('should return 500 when getClinicIdFromAdminCode throws', async () => {
                firebaseService.getClinicIdFromAdminCode.mockRejectedValue(new Error('Firebase error'));

                await createAdminProfile(req, res);

                expect(res.status).toHaveBeenCalledWith(500);
                expect(res.json).toHaveBeenCalledWith({
                    success: false,
                    message: 'Failed to create admin record',
                    error: 'Firebase error'
                });
            });

            it('should return 500 when createUserProfile throws', async () => {
                firebaseService.getClinicIdFromAdminCode.mockResolvedValue('clinic-123');
                firebaseService.createUserProfile.mockRejectedValue(new Error('Firebase error'));

                await createAdminProfile(req, res);

                expect(res.status).toHaveBeenCalledWith(500);
                expect(res.json).toHaveBeenCalledWith({
                    success: false,
                    message: 'Failed to create admin record',
                    error: 'Firebase error'
                });
            });

            it('should return 500 when claimClinic throws', async () => {
                firebaseService.getClinicIdFromAdminCode.mockResolvedValue('clinic-123');
                firebaseService.createUserProfile.mockResolvedValue();
                firebaseService.claimClinic.mockRejectedValue(new Error('Firebase error'));

                await createAdminProfile(req, res);

                expect(res.status).toHaveBeenCalledWith(500);
                expect(res.json).toHaveBeenCalledWith({
                    success: false,
                    message: 'Failed to create admin record',
                    error: 'Firebase error'
                });
            });
        });
    });
});