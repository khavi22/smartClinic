const mockVerifyIdToken = jest.fn();

const httpMocks = {
    createRequest: (options = {}) => ({
        method: "GET",
        headers: {},
        query: {},
        params: {},
        body: {},
        user: {},
        ...options,
    }),
};

jest.mock("axios");

jest.mock("../services/firebaseService", () => ({
    updateClinicOperatingHours: jest.fn(),
    ensureClinicExists: jest.fn(),
    getClinicServices: jest.fn(),
    addClinicService: jest.fn(),
    updateClinicService: jest.fn(),
    deleteClinicService: jest.fn(),
    serviceExists: jest.fn(),
}));

jest.mock("../services/clinicService", () => ({
    getAvailabilityForDate: jest.fn(),
    createAppointment: jest.fn(),
    updateClinicSlotCapacity: jest.fn(),
    getStaffUtilisationData: jest.fn(),
}));

jest.mock("../services/config/firebase", () => ({
    admin: {
        auth: () => ({
            verifyIdToken: mockVerifyIdToken,
        }),
        firestore: {
            FieldValue: {
                serverTimestamp: jest.fn(() => "mockTimestamp"),
            },
        },
    },
    db: {
        collection: jest.fn(),
    },
}));

const axios = require("axios");

const {
    updateClinicOperatingHours,
    ensureClinicExists,
    getClinicServices,
    addClinicService,
    updateClinicService,
    deleteClinicService,
    serviceExists,
} = require("../services/firebaseService");

const {
    updateClinicSlotCapacity,
    getStaffUtilisationData,
} = require("../services/clinicService");

const { admin, db } = require("../services/config/firebase");

const clinicController = require("../Controllers/ClinicsController");

function mockResponse() {
    return {
        statusCode: 200,
        body: undefined,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
    };
}

describe("Clinic Controller", () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    const mockClinicDoc = (data = { adminUid: "admin1" }, exists = true) => {
        db.collection.mockReturnValue({
            doc: () => ({
                get: jest.fn().mockResolvedValue({
                    exists,
                    data: () => data,
                }),
            }),
        });
    };

    // =====================================================
    // updateClinicHoursController
    // =====================================================

    describe("updateClinicHoursController", () => {

        it("should update clinic hours successfully", async () => {

            admin.auth().verifyIdToken.mockResolvedValue({
                uid: "admin1",
            });

            db.collection.mockReturnValue({
                doc: () => ({
                    get: jest.fn().mockResolvedValue({
                        exists: true,
                        data: () => ({
                            adminUid: "admin1",
                        }),
                    }),
                }),
            });

            updateClinicOperatingHours.mockResolvedValue();

            const req = httpMocks.createRequest({
                method: "PATCH",
                headers: {
                    authorization: "Bearer token123",
                },
                body: {
                    clinicId: "clinic1",
                    operatingHours: {
                        monday: "08:00-17:00",
                    },
                },
            });

            const res = mockResponse();

            await clinicController.updateClinicHoursController(req, res);

            expect(res.statusCode).toBe(200);

            expect(updateClinicOperatingHours)
                .toHaveBeenCalledWith(
                    "clinic1",
                    {
                        monday: "08:00-17:00",
                    }
                );
        });

        it("should return 401 if no token", async () => {

            const req = httpMocks.createRequest({
                body: {},
            });

            const res = mockResponse();

            await clinicController.updateClinicHoursController(req, res);

            expect(res.statusCode).toBe(401);
        });

        it("should return 400 if clinic hours payload is incomplete", async () => {

            admin.auth().verifyIdToken.mockResolvedValue({
                uid: "admin1",
            });

            const req = httpMocks.createRequest({
                headers: {
                    authorization: "Bearer token123",
                },
                body: {
                    clinicId: "clinic1",
                },
            });

            const res = mockResponse();

            await clinicController.updateClinicHoursController(req, res);

            expect(res.statusCode).toBe(400);
        });

        it("should return 401 if token verification fails", async () => {

            admin.auth().verifyIdToken.mockRejectedValue(
                new Error("bad token")
            );

            const req = httpMocks.createRequest({
                headers: {
                    authorization: "Bearer bad-token",
                },
                body: {
                    clinicId: "clinic1",
                    operatingHours: {
                        monday: "08:00-17:00",
                    },
                },
            });

            const res = mockResponse();

            await clinicController.updateClinicHoursController(req, res);

            expect(res.statusCode).toBe(401);
        });

        it("should return 404 if clinic is missing", async () => {

            admin.auth().verifyIdToken.mockResolvedValue({
                uid: "admin1",
            });

            db.collection.mockReturnValue({
                doc: () => ({
                    get: jest.fn().mockResolvedValue({
                        exists: false,
                    }),
                }),
            });

            const req = httpMocks.createRequest({
                headers: {
                    authorization: "Bearer token123",
                },
                body: {
                    clinicId: "clinic1",
                    operatingHours: {
                        monday: "08:00-17:00",
                    },
                },
            });

            const res = mockResponse();

            await clinicController.updateClinicHoursController(req, res);

            expect(res.statusCode).toBe(404);
        });

        it("should return 403 if the user is not clinic admin", async () => {

            admin.auth().verifyIdToken.mockResolvedValue({
                uid: "admin1",
            });

            db.collection.mockReturnValue({
                doc: () => ({
                    get: jest.fn().mockResolvedValue({
                        exists: true,
                        data: () => ({
                            adminUid: "someone-else",
                        }),
                    }),
                }),
            });

            const req = httpMocks.createRequest({
                headers: {
                    authorization: "Bearer token123",
                },
                body: {
                    clinicId: "clinic1",
                    operatingHours: {
                        monday: "08:00-17:00",
                    },
                },
            });

            const res = mockResponse();

            await clinicController.updateClinicHoursController(req, res);

            expect(res.statusCode).toBe(403);
        });

        it("should return 500 if updating operating hours fails", async () => {

            admin.auth().verifyIdToken.mockResolvedValue({
                uid: "admin1",
            });
            mockClinicDoc({ adminUid: "admin1" });
            updateClinicOperatingHours.mockRejectedValue(new Error("Update failed"));

            const req = httpMocks.createRequest({
                headers: {
                    authorization: "Bearer token123",
                },
                body: {
                    clinicId: "clinic1",
                    operatingHours: {
                        monday: "08:00-17:00",
                    },
                },
            });

            const res = mockResponse();

            await clinicController.updateClinicHoursController(req, res);

            expect(res.statusCode).toBe(500);
            expect(res.body.message).toBe("Update failed");
        });
    });

    // =====================================================
    // updateSlotCapacity
    // =====================================================

    describe("updateSlotCapacity", () => {

        it("should update slot capacity", async () => {

            admin.auth().verifyIdToken.mockResolvedValue({
                uid: "admin1",
            });

            db.collection.mockReturnValue({
                doc: () => ({
                    get: jest.fn().mockResolvedValue({
                        exists: true,
                        data: () => ({
                            adminUid: "admin1",
                        }),
                    }),
                }),
            });

            updateClinicSlotCapacity.mockResolvedValue({
                slotCapacity: 20,
            });

            const req = httpMocks.createRequest({
                params: {
                    clinicId: "clinic1",
                },
                body: {
                    slotCapacity: 20,
                },
                headers: {
                    authorization: "Bearer token123",
                },
            });

            const res = mockResponse();

            await clinicController.updateSlotCapacity(req, res);

            expect(res.statusCode).toBe(200);
        });

        it("should return 400 if slot capacity missing", async () => {

            admin.auth().verifyIdToken.mockResolvedValue({
                uid: "admin1",
            });

            db.collection.mockReturnValue({
                doc: () => ({
                    get: jest.fn().mockResolvedValue({
                        exists: true,
                        data: () => ({
                            adminUid: "admin1",
                        }),
                    }),
                }),
            });

            const req = httpMocks.createRequest({
                params: {
                    clinicId: "clinic1",
                },
                body: {},
                headers: {
                    authorization: "Bearer token123",
                },
            });

            const res = mockResponse();

            await clinicController.updateSlotCapacity(req, res);

            expect(res.statusCode).toBe(400);
        });

        it("should return 401 if slot capacity request has no token", async () => {

            const req = httpMocks.createRequest({
                params: {
                    clinicId: "clinic1",
                },
                body: {
                    slotCapacity: 20,
                },
            });

            const res = mockResponse();

            await clinicController.updateSlotCapacity(req, res);

            expect(res.statusCode).toBe(401);
        });

        it("should return 401 if slot capacity token verification fails", async () => {

            admin.auth().verifyIdToken.mockRejectedValue(new Error("bad token"));

            const req = httpMocks.createRequest({
                params: {
                    clinicId: "clinic1",
                },
                body: {
                    slotCapacity: 20,
                },
                headers: {
                    authorization: "Bearer bad-token",
                },
            });

            const res = mockResponse();

            await clinicController.updateSlotCapacity(req, res);

            expect(res.statusCode).toBe(401);
        });

        it("should return 404 if clinic is missing for slot capacity", async () => {

            admin.auth().verifyIdToken.mockResolvedValue({
                uid: "admin1",
            });
            mockClinicDoc({}, false);

            const req = httpMocks.createRequest({
                params: {
                    clinicId: "clinic1",
                },
                body: {
                    slotCapacity: 20,
                },
                headers: {
                    authorization: "Bearer token123",
                },
            });

            const res = mockResponse();

            await clinicController.updateSlotCapacity(req, res);

            expect(res.statusCode).toBe(404);
        });

        it("should return 403 if slot capacity user is not clinic admin", async () => {

            admin.auth().verifyIdToken.mockResolvedValue({
                uid: "admin1",
            });
            mockClinicDoc({ adminUid: "someone-else" });

            const req = httpMocks.createRequest({
                params: {
                    clinicId: "clinic1",
                },
                body: {
                    slotCapacity: 20,
                },
                headers: {
                    authorization: "Bearer token123",
                },
            });

            const res = mockResponse();

            await clinicController.updateSlotCapacity(req, res);

            expect(res.statusCode).toBe(403);
        });

        it("should map known slot capacity service errors", async () => {

            admin.auth().verifyIdToken.mockResolvedValue({
                uid: "admin1",
            });
            mockClinicDoc({ adminUid: "admin1" });
            updateClinicSlotCapacity.mockRejectedValue(new Error("Invalid clinic ID."));

            const req = httpMocks.createRequest({
                params: {
                    clinicId: "clinic1",
                },
                body: {
                    slotCapacity: 20,
                },
                headers: {
                    authorization: "Bearer token123",
                },
            });

            const res = mockResponse();

            await clinicController.updateSlotCapacity(req, res);

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe("Invalid clinic ID.");
        });

        it("should return 500 for unexpected slot capacity errors", async () => {

            admin.auth().verifyIdToken.mockResolvedValue({
                uid: "admin1",
            });
            mockClinicDoc({ adminUid: "admin1" });
            updateClinicSlotCapacity.mockRejectedValue(new Error("Database failed"));

            const req = httpMocks.createRequest({
                params: {
                    clinicId: "clinic1",
                },
                body: {
                    slotCapacity: 20,
                },
                headers: {
                    authorization: "Bearer token123",
                },
            });

            const res = mockResponse();

            await clinicController.updateSlotCapacity(req, res);

            expect(res.statusCode).toBe(500);
        });
    });

    // =====================================================
    // updateClinicProfile
    // =====================================================

    describe("updateClinicProfile", () => {

        it("should update clinic profile", async () => {

            const updateMock = jest.fn().mockResolvedValue();

            db.collection.mockReturnValue({
                doc: () => ({
                    update: updateMock,
                }),
            });

            const req = httpMocks.createRequest({
                user: {
                    clinicId: "clinic1",
                },
                body: {
                    province: "Gauteng",
                },
            });

            const res = mockResponse();

            await clinicController.updateClinicProfile(req, res);

            expect(res.statusCode).toBe(200);

            expect(updateMock).toHaveBeenCalled();
        });

        it("should return 400 if clinicId missing", async () => {

            const req = httpMocks.createRequest({
                user: {},
                body: {},
            });

            const res = mockResponse();

            await clinicController.updateClinicProfile(req, res);

            expect(res.statusCode).toBe(400);
        });

        it("should return 500 if clinic profile update fails", async () => {

            db.collection.mockReturnValue({
                doc: () => ({
                    update: jest.fn().mockRejectedValue(new Error("Update failed")),
                }),
            });

            const req = httpMocks.createRequest({
                user: {
                    clinicId: "clinic1",
                },
                body: {
                    facilityType: "Clinic",
                    province: "Gauteng",
                    district: "Johannesburg",
                    region: "Region A",
                    address: "123 Street",
                },
            });

            const res = mockResponse();

            await clinicController.updateClinicProfile(req, res);

            expect(res.statusCode).toBe(500);
        });
    });

    // =====================================================
    // getClinics
    // =====================================================

    describe("getClinics", () => {

        it("should fetch clinics from Google API", async () => {

            axios.post.mockResolvedValue({
                data: {
                    places: [],
                },
            });

            const req = httpMocks.createRequest({
                query: {
                    search: "Med Clinic",
                },
            });

            const res = mockResponse();

            await clinicController.getClinics(req, res);

            expect(res.statusCode).toBe(200);

            expect(axios.post).toHaveBeenCalled();
        });

        it("should build a location-based Google query", async () => {

            axios.post.mockResolvedValue({
                data: {
                    places: [],
                },
            });

            const req = httpMocks.createRequest({
                query: {
                    lat: "-26.2041",
                    lon: "28.0473",
                },
            });

            const res = mockResponse();

            await clinicController.getClinics(req, res);

            expect(res.statusCode).toBe(200);
            expect(axios.post.mock.calls[0][1]).toEqual({
                textQuery: "clinic near -26.2041,28.0473 in South Africa",
            });
        });

        it("should return 500 on axios failure", async () => {

            axios.post.mockRejectedValue(
                new Error("Google Error")
            );

            const req = httpMocks.createRequest({
                query: {
                    search: "Clinic",
                },
            });

            const res = mockResponse();

            await clinicController.getClinics(req, res);

            expect(res.statusCode).toBe(500);
        });
    });

    // =====================================================
    // ensureClinicExistsController
    // =====================================================

    describe("ensureClinicExistsController", () => {

        it("should ensure clinic exists", async () => {

            ensureClinicExists.mockResolvedValue({
                success: true,
            });

            const req = httpMocks.createRequest({
                body: {
                    clinicId: "clinic1",
                    name: "Clinic A",
                    address: "Address",
                },
            });

            const res = mockResponse();

            await clinicController.ensureClinicExistsController(req, res);

            expect(res.statusCode).toBe(200);
        });

        it("should return 400 if missing fields", async () => {

            const req = httpMocks.createRequest({
                body: {},
            });

            const res = mockResponse();

            await clinicController.ensureClinicExistsController(req, res);

            expect(res.statusCode).toBe(400);
        });

        it("should return 500 if ensure clinic fails", async () => {

            ensureClinicExists.mockRejectedValue(new Error("Ensure failed"));

            const req = httpMocks.createRequest({
                body: {
                    clinicId: "clinic1",
                    name: "Clinic A",
                },
            });

            const res = mockResponse();

            await clinicController.ensureClinicExistsController(req, res);

            expect(res.statusCode).toBe(500);
        });
    });

    describe("getServiceTemplates", () => {

        it("should return service templates", async () => {

            db.collection.mockReturnValue({
                get: jest.fn().mockResolvedValue({
                    docs: [
                        {
                            id: "template1",
                            data: () => ({ name: "General" }),
                        },
                    ],
                }),
            });

            const req = httpMocks.createRequest();
            const res = mockResponse();

            await clinicController.getServiceTemplates(req, res);

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual([{ id: "template1", name: "General" }]);
        });

        it("should return 500 when service template lookup fails", async () => {

            db.collection.mockReturnValue({
                get: jest.fn().mockRejectedValue(new Error("Template failure")),
            });

            const req = httpMocks.createRequest();
            const res = mockResponse();

            await clinicController.getServiceTemplates(req, res);

            expect(res.statusCode).toBe(500);
        });
    });

    describe("seedServiceTemplates", () => {

        it("should report already seeded when templates exist", async () => {

            db.collection.mockReturnValue({
                limit: () => ({
                    get: jest.fn().mockResolvedValue({
                        empty: false,
                    }),
                }),
            });

            const req = httpMocks.createRequest();
            const res = mockResponse();

            await clinicController.seedServiceTemplates(req, res);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toBe("Already seeded");
        });

        it("should report seed instructions when templates are absent", async () => {

            db.collection.mockReturnValue({
                limit: () => ({
                    get: jest.fn().mockResolvedValue({
                        empty: true,
                    }),
                }),
            });

            const req = httpMocks.createRequest();
            const res = mockResponse();

            await clinicController.seedServiceTemplates(req, res);

            expect(res.statusCode).toBe(200);
            expect(res.body.message).toContain("seed");
        });

        it("should return 500 when seed check fails", async () => {

            db.collection.mockReturnValue({
                limit: () => ({
                    get: jest.fn().mockRejectedValue(new Error("Seed failed")),
                }),
            });

            const req = httpMocks.createRequest();
            const res = mockResponse();

            await clinicController.seedServiceTemplates(req, res);

            expect(res.statusCode).toBe(500);
        });
    });

    // =====================================================
    // getServices
    // =====================================================

    describe("getServices", () => {

        it("should fetch clinic services", async () => {

            getClinicServices.mockResolvedValue([
                {
                    id: "service1",
                },
            ]);

            const req = httpMocks.createRequest({
                query: {
                    clinicId: "clinic1",
                },
            });

            const res = mockResponse();

            await clinicController.getServices(req, res);

            expect(res.statusCode).toBe(200);

            expect(getClinicServices)
                .toHaveBeenCalledWith("clinic1");
        });

        it("should return 400 if clinicId missing", async () => {

            const req = httpMocks.createRequest({
                query: {},
                headers: {},
            });

            const res = mockResponse();

            await clinicController.getServices(req, res);

            expect(res.statusCode).toBe(400);
        });

        it("should resolve clinic id from optional admin auth", async () => {

            admin.auth().verifyIdToken.mockResolvedValue({
                uid: "admin1",
            });
            db.collection.mockReturnValue({
                where: () => ({
                    limit: () => ({
                        get: jest.fn().mockResolvedValue({
                            empty: false,
                            docs: [{ id: "clinic-from-token" }],
                        }),
                    }),
                }),
            });
            getClinicServices.mockResolvedValue([{ id: "service1" }]);

            const req = httpMocks.createRequest({
                query: {},
                headers: {
                    authorization: "Bearer token123",
                },
            });

            const res = mockResponse();

            await clinicController.getServices(req, res);

            expect(res.statusCode).toBe(200);
            expect(getClinicServices).toHaveBeenCalledWith("clinic-from-token");
        });

        it("should continue to 400 if optional auth decoding fails", async () => {

            admin.auth().verifyIdToken.mockRejectedValue(new Error("bad token"));

            const req = httpMocks.createRequest({
                query: {},
                headers: {
                    authorization: "Bearer bad-token",
                },
            });

            const res = mockResponse();

            await clinicController.getServices(req, res);

            expect(res.statusCode).toBe(400);
        });

        it("should return 500 if service lookup fails", async () => {

            getClinicServices.mockRejectedValue(new Error("Services failed"));

            const req = httpMocks.createRequest({
                query: {
                    clinicId: "clinic1",
                },
            });

            const res = mockResponse();

            await clinicController.getServices(req, res);

            expect(res.statusCode).toBe(500);
        });
    });

    // =====================================================
    // addService
    // =====================================================

    describe("addService", () => {

        it("should add service successfully", async () => {

            serviceExists.mockResolvedValue(false);

            addClinicService.mockResolvedValue("service123");

            const req = httpMocks.createRequest({
                user: {
                    clinicId: "clinic1",
                },
                body: {
                    name: "Consultation",
                    description: "General checkup",
                    duration: 30,
                },
            });

            const res = mockResponse();

            await clinicController.addService(req, res);

            expect(res.statusCode).toBe(201);
        });

        it("should return 409 if service already exists", async () => {

            serviceExists.mockResolvedValue(true);

            const req = httpMocks.createRequest({
                user: {
                    clinicId: "clinic1",
                },
                body: {
                    name: "Consultation",
                    description: "General checkup",
                    duration: 30,
                },
            });

            const res = mockResponse();

            await clinicController.addService(req, res);

            expect(res.statusCode).toBe(409);
        });

        it("should return 400 if adding service has no clinic id", async () => {

            const req = httpMocks.createRequest({
                user: {},
                body: {
                    name: "Consultation",
                    description: "General checkup",
                    duration: 30,
                },
            });

            const res = mockResponse();

            await clinicController.addService(req, res);

            expect(res.statusCode).toBe(400);
        });

        it("should return 400 if service payload is invalid", async () => {

            const req = httpMocks.createRequest({
                user: {
                    clinicId: "clinic1",
                },
                body: {
                    name: "Consultation",
                    description: "General checkup",
                    duration: 0,
                },
            });

            const res = mockResponse();

            await clinicController.addService(req, res);

            expect(res.statusCode).toBe(400);
        });

        it("should return 500 if adding service fails", async () => {

            serviceExists.mockResolvedValue(false);
            addClinicService.mockRejectedValue(new Error("Add failed"));

            const req = httpMocks.createRequest({
                user: {
                    clinicId: "clinic1",
                },
                body: {
                    name: "Consultation",
                    description: "General checkup",
                    duration: 30,
                },
            });

            const res = mockResponse();

            await clinicController.addService(req, res);

            expect(res.statusCode).toBe(500);
        });
    });

    // =====================================================
    // updateService
    // =====================================================

    describe("updateService", () => {

        it("should update service", async () => {

            updateClinicService.mockResolvedValue();

            const req = httpMocks.createRequest({
                user: {
                    clinicId: "clinic1",
                },
                params: {
                    serviceId: "service1",
                },
                body: {
                    name: "Updated Service",
                },
            });

            const res = mockResponse();

            await clinicController.updateService(req, res);

            expect(res.statusCode).toBe(200);
        });

        it("should return 400 if updating service has no clinic id", async () => {

            const req = httpMocks.createRequest({
                user: {},
                params: {
                    serviceId: "service1",
                },
                body: {
                    name: "Updated Service",
                },
            });

            const res = mockResponse();

            await clinicController.updateService(req, res);

            expect(res.statusCode).toBe(400);
        });

        it("should return 500 if updating service fails", async () => {

            updateClinicService.mockRejectedValue(new Error("Update failed"));

            const req = httpMocks.createRequest({
                user: {
                    clinicId: "clinic1",
                },
                params: {
                    serviceId: "service1",
                },
                body: {
                    name: "Updated Service",
                },
            });

            const res = mockResponse();

            await clinicController.updateService(req, res);

            expect(res.statusCode).toBe(500);
        });
    });

    // =====================================================
    // deleteService
    // =====================================================

    describe("deleteService", () => {

        it("should delete service", async () => {

            deleteClinicService.mockResolvedValue();

            const req = httpMocks.createRequest({
                user: {
                    clinicId: "clinic1",
                },
                params: {
                    serviceId: "service1",
                },
            });

            const res = mockResponse();

            await clinicController.deleteService(req, res);

            expect(res.statusCode).toBe(200);
        });

        it("should return 400 if deleting service has no clinic id", async () => {

            const req = httpMocks.createRequest({
                user: {},
                params: {
                    serviceId: "service1",
                },
            });

            const res = mockResponse();

            await clinicController.deleteService(req, res);

            expect(res.statusCode).toBe(400);
        });

        it("should return 500 if deleting service fails", async () => {

            deleteClinicService.mockRejectedValue(new Error("Delete failed"));

            const req = httpMocks.createRequest({
                user: {
                    clinicId: "clinic1",
                },
                params: {
                    serviceId: "service1",
                },
            });

            const res = mockResponse();

            await clinicController.deleteService(req, res);

            expect(res.statusCode).toBe(500);
        });
    });

    // =====================================================
    // getStaffUtilisationReport
    // =====================================================

    describe("getStaffUtilisationReport", () => {

        it("should fetch staff utilisation report", async () => {

            admin.auth().verifyIdToken.mockResolvedValue({
                uid: "admin1",
            });

            db.collection.mockReturnValue({
                doc: () => ({
                    get: jest.fn().mockResolvedValue({
                        exists: true,
                        data: () => ({
                            adminUid: "admin1",
                            clinicName: "Clinic A",
                        }),
                    }),
                }),
            });

            getStaffUtilisationData.mockResolvedValue({
                utilisation: [],
            });

            const req = httpMocks.createRequest({
                params: {
                    clinicId: "clinic1",
                },
                query: {
                    startDate: "2026-05-01",
                    endDate: "2026-05-31",
                },
                headers: {
                    authorization: "Bearer token123",
                },
            });

            const res = mockResponse();

            await clinicController.getStaffUtilisationReport(req, res);

            expect(res.statusCode).toBe(200);
        });

        it("should return 401 if unauthorized", async () => {

            const req = httpMocks.createRequest({
                params: {
                    clinicId: "clinic1",
                },
                query: {},
                headers: {},
            });

            const res = mockResponse();

            await clinicController.getStaffUtilisationReport(req, res);

            expect(res.statusCode).toBe(401);
        });

        it("should return 401 if staff utilisation token is invalid", async () => {

            admin.auth().verifyIdToken.mockRejectedValue(new Error("bad token"));

            const req = httpMocks.createRequest({
                params: {
                    clinicId: "clinic1",
                },
                query: {
                    startDate: "2026-05-01",
                    endDate: "2026-05-31",
                },
                headers: {
                    authorization: "Bearer bad-token",
                },
            });

            const res = mockResponse();

            await clinicController.getStaffUtilisationReport(req, res);

            expect(res.statusCode).toBe(401);
        });

        it("should return 404 if staff utilisation clinic is missing", async () => {

            admin.auth().verifyIdToken.mockResolvedValue({
                uid: "admin1",
            });
            mockClinicDoc({}, false);

            const req = httpMocks.createRequest({
                params: {
                    clinicId: "clinic1",
                },
                query: {
                    startDate: "2026-05-01",
                    endDate: "2026-05-31",
                },
                headers: {
                    authorization: "Bearer token123",
                },
            });

            const res = mockResponse();

            await clinicController.getStaffUtilisationReport(req, res);

            expect(res.statusCode).toBe(404);
        });

        it("should return 403 if staff utilisation user is not clinic admin", async () => {

            admin.auth().verifyIdToken.mockResolvedValue({
                uid: "admin1",
            });
            mockClinicDoc({ adminUid: "someone-else" });

            const req = httpMocks.createRequest({
                params: {
                    clinicId: "clinic1",
                },
                query: {
                    startDate: "2026-05-01",
                    endDate: "2026-05-31",
                },
                headers: {
                    authorization: "Bearer token123",
                },
            });

            const res = mockResponse();

            await clinicController.getStaffUtilisationReport(req, res);

            expect(res.statusCode).toBe(403);
        });

        it("should return 400 if staff utilisation dates are missing", async () => {

            admin.auth().verifyIdToken.mockResolvedValue({
                uid: "admin1",
            });
            mockClinicDoc({ adminUid: "admin1" });

            const req = httpMocks.createRequest({
                params: {
                    clinicId: "clinic1",
                },
                query: {},
                headers: {
                    authorization: "Bearer token123",
                },
            });

            const res = mockResponse();

            await clinicController.getStaffUtilisationReport(req, res);

            expect(res.statusCode).toBe(400);
        });

        it("should return 500 if staff utilisation lookup fails", async () => {

            admin.auth().verifyIdToken.mockResolvedValue({
                uid: "admin1",
            });
            mockClinicDoc({ adminUid: "admin1", clinicName: "Clinic A" });
            getStaffUtilisationData.mockRejectedValue(new Error("Report failed"));

            const req = httpMocks.createRequest({
                params: {
                    clinicId: "clinic1",
                },
                query: {
                    startDate: "2026-05-01",
                    endDate: "2026-05-31",
                },
                headers: {
                    authorization: "Bearer token123",
                },
            });

            const res = mockResponse();

            await clinicController.getStaffUtilisationReport(req, res);

            expect(res.statusCode).toBe(500);
        });
    });
});
