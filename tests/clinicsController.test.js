const axios = require("axios");
const firebaseService = require("../services/firebaseService");
const { admin, db } = require("../services/config/firebase");
const {
    ensureClinicExistsController,
    updateClinicHoursController,
    getClinics
} = require("../Controllers/ClinicsController");

jest.mock("axios");
jest.mock("../services/firebaseService");
const mockVerifyIdToken = jest.fn().mockResolvedValue({ uid: "admin-123" });
jest.mock("../services/config/firebase", () => ({
    admin: {
        auth: () => ({
            verifyIdToken: mockVerifyIdToken
        })
    },
    db: {
        collection: jest.fn()
    }
}));

describe("ClinicsController", () => {
    let req, res;

    beforeEach(() => {
        req = {
            body: {},
            headers: {},
            query: {}
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            send: jest.fn()
        };
        jest.clearAllMocks();
        jest.spyOn(console, "log").mockImplementation(() => {});
        jest.spyOn(console, "error").mockImplementation(() => {});
    });

    describe("ensureClinicExistsController", () => {
        it("should return 400 if clinicId missing", async () => {
            await ensureClinicExistsController(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it("should call service if data is correct", async () => {
            req.body = { clinicId: "c1", name: "N" };
            firebaseService.ensureClinicExists.mockResolvedValue({ success: true });
            await ensureClinicExistsController(req, res);
            expect(firebaseService.ensureClinicExists).toHaveBeenCalled();
        });

        it("should return 500 when ensure clinic exists fails", async () => {
            req.body = { clinicId: "c1", name: "N" };
            firebaseService.ensureClinicExists.mockRejectedValue(new Error("Init failed"));

            await ensureClinicExistsController(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: "Failed to initialize clinic",
                error: "Init failed"
            }));
        });
    });

    describe("updateClinicHoursController", () => {
        it("should return 401 if unauthorized", async () => {
            await updateClinicHoursController(req, res);
            expect(res.status).toHaveBeenCalledWith(401);
        });

        it("should return 401 if token verification fails", async () => {
            req.headers.authorization = "Bearer token";
            mockVerifyIdToken.mockRejectedValueOnce(new Error("Bad token"));

            await updateClinicHoursController(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Unauthorized: Invalid token"
            });
        });

        it("should return 400 if missing body", async () => {
            req.headers.authorization = "Bearer token";
            await updateClinicHoursController(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it("should return 404 if clinic does not exist", async () => {
            req.headers.authorization = "Bearer token";
            req.body = { clinicId: "c1", operatingHours: {} };

            db.collection.mockReturnValue({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({ exists: false })
                }))
            });

            await updateClinicHoursController(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        it("should return 403 if not owner", async () => {
            req.headers.authorization = "Bearer token";
            req.body = { clinicId: "c1", operatingHours: {} };
            
            db.collection.mockReturnValue({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ adminUid: "OTHER" }) })
                }))
            });

            await updateClinicHoursController(req, res);
            expect(res.status).toHaveBeenCalledWith(403);
        });

        it("should return 200 on success", async () => {
            req.headers.authorization = "Bearer token";
            req.body = { clinicId: "c1", operatingHours: {} };
            
            db.collection.mockReturnValue({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ adminUid: "admin-123" }) })
                }))
            });

            await updateClinicHoursController(req, res);
            expect(firebaseService.updateClinicOperatingHours).toHaveBeenCalled();
        });

        it("should return 500 if the update service throws", async () => {
            req.headers.authorization = "Bearer token";
            req.body = { clinicId: "c1", operatingHours: {} };
            firebaseService.updateClinicOperatingHours.mockRejectedValue(new Error("Update failed"));

            db.collection.mockReturnValue({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ adminUid: "admin-123" }) })
                }))
            });

            await updateClinicHoursController(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe("getClinics", () => {
        it("should return clinic data from Google Places", async () => {
            req.query = { search: "clinic" };
            axios.post.mockResolvedValue({ data: { places: [] } });
            await getClinics(req, res);
            expect(res.json).toHaveBeenCalledWith({ places: [] });
        });

        it("should return 500 on error", async () => {
            req.query = { lat: "1", lon: "2" };
            axios.post.mockRejectedValue(new Error("Network Error"));
            await getClinics(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe("getServiceTemplates", () => {
        it("should return templates successfully", async () => {
            const mockTemplates = [{ id: "t1", name: "Consultation" }];
            db.collection.mockReturnValue({
                get: jest.fn().mockResolvedValue({
                    docs: [{ id: "t1", data: () => ({ name: "Consultation" }) }]
                })
            });

            const controller = require("../Controllers/ClinicsController");
            await controller.getServiceTemplates(req, res);

            expect(res.json).toHaveBeenCalledWith(mockTemplates);
        });

        it("should return 500 on error", async () => {
            db.collection.mockReturnValue({
                get: jest.fn().mockRejectedValue(new Error("DB Error"))
            });
            await require("../Controllers/ClinicsController").getServiceTemplates(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe("seedServiceTemplates", () => {
        it("should return already seeded message if not empty", async () => {
            db.collection.mockReturnValue({
                limit: jest.fn().mockReturnThis(),
                get: jest.fn().mockResolvedValue({ empty: false })
            });
            await require("../Controllers/ClinicsController").seedServiceTemplates(req, res);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Already seeded" }));
        });

        it("should return instructions if empty", async () => {
            db.collection.mockReturnValue({
                limit: jest.fn().mockReturnThis(),
                get: jest.fn().mockResolvedValue({ empty: true })
            });
            await require("../Controllers/ClinicsController").seedServiceTemplates(req, res);
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("Use node scripts") }));
        });

        it("should return 500 on error", async () => {
            db.collection.mockReturnValue({
                limit: jest.fn().mockReturnThis(),
                get: jest.fn().mockRejectedValue(new Error("Seed fail"))
            });
            await require("../Controllers/ClinicsController").seedServiceTemplates(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe("Service Management", () => {
        beforeEach(() => {
            req.user = { clinicId: "clinic-123" };
        });

        it("getServices should return services successfully", async () => {
            const mockServices = [{ id: "s1", name: "Checkup" }];
            firebaseService.getClinicServices.mockResolvedValue(mockServices);
            
            await require("../Controllers/ClinicsController").getServices(req, res);
            
            expect(res.json).toHaveBeenCalledWith(mockServices);
        });

        it("addService should create a service", async () => {
            req.body = { name: "S1", description: "D", duration: 30 };
            firebaseService.serviceExists.mockResolvedValue(false);
            firebaseService.addClinicService.mockResolvedValue("new-id");

            await require("../Controllers/ClinicsController").addService(req, res);

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: "new-id" }));
        });

        it("addService should return 409 if exists", async () => {
            req.body = { name: "S1", description: "D", duration: 30 };
            firebaseService.serviceExists.mockResolvedValue(true);

            await require("../Controllers/ClinicsController").addService(req, res);

            expect(res.status).toHaveBeenCalledWith(409);
        });

        it("updateService should call service with data", async () => {
            req.params = { serviceId: "s1" };
            req.body = { duration: 45 };
            
            await require("../Controllers/ClinicsController").updateService(req, res);
            
            expect(firebaseService.updateClinicService).toHaveBeenCalledWith("clinic-123", "s1", req.body);
            expect(res.json).toHaveBeenCalled();
        });

        it("deleteService should call service with id", async () => {
            req.params = { serviceId: "s1" };
            
            await require("../Controllers/ClinicsController").deleteService(req, res);
            
            expect(firebaseService.deleteClinicService).toHaveBeenCalledWith("clinic-123", "s1");
            expect(res.json).toHaveBeenCalled();
        });

        it("should return 400 if clinicId is missing on user", async () => {
            req.user = {};
            await require("../Controllers/ClinicsController").getServices(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });
    });
});
