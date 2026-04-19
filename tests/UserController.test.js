const { createAdminProfile } = require('../controllers/UserController');
const firebaseService = require("../services/firebaseService");

jest.mock("../services/firebaseService");

describe('createAdminProfile - Controller', () => {
    let req, res;

    beforeEach(() => {
        req = {
            body: {
                uid: 'test-uid',
                fullName: 'John Doe',
                email: 'john@example.com',
                phone: '1234567890',
                adminCode: 'ADM-A1B2C3'
            }
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };

        jest.clearAllMocks();
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