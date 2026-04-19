const { createAdminProfile } = require('../controllers/userController');
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
                adminCode: 'ADM001',
                assignedClinic: 'Clinic A'
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
            firebaseService.createAdminProfile.mockResolvedValue();

            await createAdminProfile(req, res);

            expect(firebaseService.createAdminProfile).toHaveBeenCalledWith({
                uid: 'test-uid',
                fullName: 'John Doe',
                email: 'john@example.com',
                phone: '1234567890',
                adminCode: 'ADM001',
                assignedClinic: 'Clinic A'
            });
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: 'Admin account created successfully'
            });
        });
    });

    describe('Validation cases', () => {
        it.each([
            ['uid',      { fullName: 'John', email: 'j@j.com', phone: '123' }],
            ['fullName', { uid: '1',         email: 'j@j.com', phone: '123' }],
            ['email',    { uid: '1',         fullName: 'John',  phone: '123' }],
            ['phone',    { uid: '1',         fullName: 'John',  email: 'j@j.com' }]
        ])('should return 400 when %s is missing', async (missingField, body) => {
            req.body = body;

            await createAdminProfile(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: 'Missing required fields'
            });
            expect(firebaseService.createAdminProfile).not.toHaveBeenCalled();
        });
    });

    describe('Error cases', () => {
        it('should return 500 when firebaseService throws', async () => {
            const error = new Error('Firebase error');
            firebaseService.createAdminProfile.mockRejectedValue(error);

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