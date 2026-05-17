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
    });
});
