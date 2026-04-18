const  firebaseService = require("../services/firebaseService");
const { checkUserLogin , createPatientProfileController} = require("../Controllers/userController");

jest.mock("../services/firebaseService");

describe("checkUserLogin controller", () => {
    let req;
    let res;

    beforeEach(() => {
        req = {
            params: {}
        };

        res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        jest.clearAllMocks();
        jest.spyOn(console, "error").mockImplementation(() => {});
    });

    it("should return 400 if userId is missing", async () => {
        await checkUserLogin(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            error: "Missing userId"
        });
    });

    it("should return dashboard redirect if user exists", async () => {
        req.params.userId = "user123";

        const mockUser = {
            id: "user123",
            name: "Martin"
        };

        firebaseService.getUserProfileById.mockResolvedValue(mockUser);

        await checkUserLogin(req, res);

        expect(firebaseService.getUserProfileById).toHaveBeenCalledWith("user123");
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
    let req;
    let res;

    beforeEach(() => {
        req = {
            body: {}
        };

        res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis()
        };

        jest.clearAllMocks();
        jest.spyOn(console, "error").mockImplementation(() => {});
    });

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