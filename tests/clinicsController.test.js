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

// Suite: groups related coverage for Clinic Controller.
describe("Clinic Controller", () => {

    // Setup: resets shared mocks and test data before each case in this scope.
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

    // Suite: groups related coverage for updateClinicHoursController.
    describe("updateClinicHoursController", () => {

        // Test: checks should update clinic hours successfully. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 401 if no token. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return 401 if no token", async () => {

            const req = httpMocks.createRequest({
                body: {},
            });

            const res = mockResponse();

            await clinicController.updateClinicHoursController(req, res);

            expect(res.statusCode).toBe(401);
        });

        // Test: checks should return 400 if clinic hours payload is incomplete. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 401 if token verification fails. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 404 if clinic is missing. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 403 if the user is not clinic admin. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 500 if updating operating hours fails. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

    // Suite: groups related coverage for updateSlotCapacity.
    describe("updateSlotCapacity", () => {

        // Test: checks should update slot capacity. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 400 if slot capacity missing. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 401 if slot capacity request has no token. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 401 if slot capacity token verification fails. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 404 if clinic is missing for slot capacity. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 403 if slot capacity user is not clinic admin. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should map known slot capacity service errors. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 500 for unexpected slot capacity errors. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

    // Suite: groups related coverage for updateClinicProfile.
    describe("updateClinicProfile", () => {

        // Test: checks should update clinic profile. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 400 if clinicId missing. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return 400 if clinicId missing", async () => {

            const req = httpMocks.createRequest({
                user: {},
                body: {},
            });

            const res = mockResponse();

            await clinicController.updateClinicProfile(req, res);

            expect(res.statusCode).toBe(400);
        });

        // Test: checks should return 500 if clinic profile update fails. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

    // Suite: groups related coverage for getClinics.
    describe("getClinics", () => {

        // Test: checks should fetch clinics from Google API. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should build a location-based Google query. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 500 on axios failure. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

    // Suite: groups related coverage for ensureClinicExistsController.
    describe("ensureClinicExistsController", () => {

        // Test: checks should ensure clinic exists. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 400 if missing fields. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return 400 if missing fields", async () => {

            const req = httpMocks.createRequest({
                body: {},
            });

            const res = mockResponse();

            await clinicController.ensureClinicExistsController(req, res);

            expect(res.statusCode).toBe(400);
        });

        // Test: checks should return 500 if ensure clinic fails. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

    // Suite: groups related coverage for getServiceTemplates.
    describe("getServiceTemplates", () => {

        // Test: checks should return service templates. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 500 when service template lookup fails. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

    // Suite: groups related coverage for seedServiceTemplates.
    describe("seedServiceTemplates", () => {

        // Test: checks should report already seeded when templates exist. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should report seed instructions when templates are absent. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 500 when seed check fails. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

    // Suite: groups related coverage for getServices.
    describe("getServices", () => {

        // Test: checks should fetch clinic services. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 400 if clinicId missing. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return 400 if clinicId missing", async () => {

            const req = httpMocks.createRequest({
                query: {},
                headers: {},
            });

            const res = mockResponse();

            await clinicController.getServices(req, res);

            expect(res.statusCode).toBe(400);
        });

        // Test: checks should resolve clinic id from optional admin auth. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should continue to 400 if optional auth decoding fails. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 500 if service lookup fails. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

    // Suite: groups related coverage for addService.
    describe("addService", () => {

        // Test: checks should add service successfully. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 409 if service already exists. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 400 if adding service has no clinic id. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 400 if service payload is invalid. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 500 if adding service fails. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

    // Suite: groups related coverage for updateService.
    describe("updateService", () => {

        // Test: checks should update service. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 400 if updating service has no clinic id. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 500 if updating service fails. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

    // Suite: groups related coverage for deleteService.
    describe("deleteService", () => {

        // Test: checks should delete service. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 400 if deleting service has no clinic id. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 500 if deleting service fails. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

    // Suite: groups related coverage for getStaffUtilisationReport.
    describe("getStaffUtilisationReport", () => {

        // Test: checks should fetch staff utilisation report. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 401 if unauthorized. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 401 if staff utilisation token is invalid. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 404 if staff utilisation clinic is missing. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 403 if staff utilisation user is not clinic admin. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 400 if staff utilisation dates are missing. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks should return 500 if staff utilisation lookup fails. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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
