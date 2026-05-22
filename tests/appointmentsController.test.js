const httpMocks = {
    createRequest: (options = {}) => ({
        method: "GET",
        headers: {},
        query: {},
        params: {},
        body: {},
        ...options,
    }),
};

jest.mock("../services/firebaseService", () => ({
    getAvailabilityForDate: jest.fn(),
    createAppointment: jest.fn(),
    getAppointmentsByPatientId: jest.fn(),
    cancelAppointment: jest.fn(),
    getPatientProfileById: jest.fn(),
    getUserProfileByEmail: jest.fn(),
}));

jest.mock("../services/emailService", () => ({
    sendAppointmentConfirmation: jest.fn(),
    sendAppointmentCancellation: jest.fn(),
}));

jest.mock("../services/config/firebase", () => ({
    admin: {
        firestore: jest.fn(),
    },
    db: {
        collection: jest.fn(),
    },
}));

const appointmentController = require("../Controllers/appointmentsController");

const {
    getAvailabilityForDate,
    createAppointment,
    getAppointmentsByPatientId,
    cancelAppointment,
    getPatientProfileById,
    getUserProfileByEmail,
} = require("../services/firebaseService");

const emailService = require("../services/emailService");

const { admin, db } = require("../services/config/firebase");

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

// Suite: groups related coverage for Appointment Controller.
describe("Appointment Controller", () => {

    // Setup: resets shared mocks and test data before each case in this scope.
    beforeEach(() => {
        jest.clearAllMocks();

        global.fetch = jest.fn();
    });

    // =====================================================
    // getAvailability
    // =====================================================

    // Suite: groups related coverage for getAvailability.
    describe("getAvailability", () => {

        // Test: checks should return availability slots. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return availability slots", async () => {

            getAvailabilityForDate.mockResolvedValue([
                {
                    time: "10:00",
                    available: true,
                },
            ]);

            const req = httpMocks.createRequest({
                query: {
                    date: "2026-05-20",
                    clinicId: "clinic1",
                },
            });

            const res = mockResponse();

            await appointmentController.getAvailability(req, res);

            expect(res.statusCode).toBe(200);

            expect(getAvailabilityForDate)
                .toHaveBeenCalledWith(
                    "clinic1",
                    "2026-05-20"
                );
        });

        // Test: checks should return 400 if date missing. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return 400 if date missing", async () => {

            const req = httpMocks.createRequest({
                query: {},
            });

            const res = mockResponse();

            await appointmentController.getAvailability(req, res);

            expect(res.statusCode).toBe(400);
        });

        // Test: checks should return 500 if availability lookup fails. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return 500 if availability lookup fails", async () => {

            getAvailabilityForDate.mockRejectedValue(new Error("Availability failed"));

            const req = httpMocks.createRequest({
                query: {
                    date: "2026-05-20",
                },
            });

            const res = mockResponse();

            await appointmentController.getAvailability(req, res);

            expect(res.statusCode).toBe(500);
        });
    });

    // Suite: groups related coverage for getRecommendations.
    describe("getRecommendations", () => {

        // Test: checks should fetch ML predictions and return recommended slots. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should fetch ML predictions and return recommended slots", async () => {

            fetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    predictions: [
                        {
                            timeSlot: "10:00",
                            recommended: true,
                        },
                        {
                            timeSlot: "11:00",
                            recommended: false,
                        }
                    ],
                }),
            });

            process.env.ML_SERVICE_URL = "http://localhost:5000";

            const req = httpMocks.createRequest({
                query: {
                    date: "2099-05-20",
                    clinicId: "clinic1",
                },
            });

            const res = mockResponse();

            await appointmentController.getRecommendations(req, res);

            expect(res.statusCode).toBe(200);
            expect(res.body.recommendations).toContain("10:00");
            expect(res.body.recommendations).not.toContain("11:00");
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining("clinicId=clinic1"),
                expect.any(Object)
            );
        });

        // Test: checks should return 400 if date missing. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return 400 if date missing", async () => {

            const req = httpMocks.createRequest({
                query: {},
            });

            const res = mockResponse();

            await appointmentController.getRecommendations(req, res);

            expect(res.statusCode).toBe(400);
        });

        // Test: checks should continue and return empty if ML service fails. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should continue and return empty if ML service fails", async () => {

            fetch.mockRejectedValue(new Error("ML failed"));

            process.env.ML_SERVICE_URL = "http://localhost:5000";

            const req = httpMocks.createRequest({
                query: {
                    date: "2026-05-20",
                },
            });

            const res = mockResponse();

            await appointmentController.getRecommendations(req, res);

            expect(res.statusCode).toBe(200);
            expect(res.body.recommendations).toEqual([]);
        });

        // Test: checks should return empty if ML_SERVICE_URL not configured. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return empty if ML_SERVICE_URL not configured", async () => {
            delete process.env.ML_SERVICE_URL;

            const req = httpMocks.createRequest({
                query: {
                    date: "2026-05-20",
                },
            });

            const res = mockResponse();

            await appointmentController.getRecommendations(req, res);

            expect(res.statusCode).toBe(200);
            expect(res.body.recommendations).toEqual([]);
        });
    });

    // =====================================================
    // postAppointment
    // =====================================================

    // Suite: groups related coverage for postAppointment.
    describe("postAppointment", () => {

        // Test: checks should create appointment successfully. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should create appointment successfully", async () => {

            createAppointment.mockResolvedValue({
                id: "appointment1",
            });

            getPatientProfileById.mockResolvedValue({
                email: "test@example.com",
                fullName: "John Doe",
            });

            emailService.sendAppointmentConfirmation.mockResolvedValue();

            const req = httpMocks.createRequest({
                body: {
                    patientId: "patient1",
                    clinicId: "clinic1",
                    date: "2026-05-20",
                    timeSlot: "10:00",
                    clinicName: "Clinic A",
                    clinicAddress: "Address A",
                    serviceId: "service1",
                    serviceName: "Consultation",
                    serviceDuration: 30,
                },
            });

            const res = mockResponse();

            await appointmentController.postAppointment(req, res);

            expect(res.statusCode).toBe(200);

            expect(createAppointment).toHaveBeenCalled();

            expect(emailService.sendAppointmentConfirmation)
                .toHaveBeenCalled();
        });

        // Test: checks should return 400 when date missing. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return 400 when date missing", async () => {

            const req = httpMocks.createRequest({
                body: {
                    timeSlot: "10:00",
                },
            });

            const res = mockResponse();

            await appointmentController.postAppointment(req, res);

            expect(res.statusCode).toBe(400);
        });

        // Test: checks should return 400 when service info missing. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return 400 when service info missing", async () => {

            const req = httpMocks.createRequest({
                body: {
                    patientId: "patient1",
                    date: "2026-05-20",
                    timeSlot: "10:00",
                },
            });

            const res = mockResponse();

            await appointmentController.postAppointment(req, res);

            expect(res.statusCode).toBe(400);
        });

        // Test: checks should create appointment by patient email. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should create appointment by patient email", async () => {

            getUserProfileByEmail.mockResolvedValue({
                uid: "patient-email-uid",
                role: "patient",
                email: "patient@example.com",
            });

            createAppointment.mockResolvedValue({
                id: "appointment-by-email",
                timeSlot: "10:00",
            });

            getPatientProfileById.mockResolvedValue({
                email: "patient@example.com",
                fullName: "Patient Email",
            });

            const req = httpMocks.createRequest({
                body: {
                    patientEmail: "patient@example.com",
                    clinicId: "clinic1",
                    date: "2026-05-20",
                    timeSlot: "10:00",
                    clinicName: "Clinic A",
                    clinicAddress: "Address A",
                    serviceId: "service1",
                    serviceName: "Consultation",
                    serviceDuration: 30,
                },
            });

            const res = mockResponse();

            await appointmentController.postAppointment(req, res);

            expect(res.statusCode).toBe(200);
            expect(getUserProfileByEmail).toHaveBeenCalledWith("patient@example.com");
            expect(createAppointment).toHaveBeenCalledWith(
                "clinic1",
                "2026-05-20",
                "10:00",
                "patient-email-uid",
                "Clinic A",
                "Address A",
                false,
                "service1",
                "Consultation",
                30
            );
        });

        // Test: checks should return 404 when patient email has no account. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return 404 when patient email has no account", async () => {

            getUserProfileByEmail.mockResolvedValue(null);

            const req = httpMocks.createRequest({
                body: {
                    patientEmail: "missing@example.com",
                    date: "2026-05-20",
                    timeSlot: "10:00",
                    serviceId: "service1",
                    serviceName: "Consultation",
                    serviceDuration: 30,
                },
            });

            const res = mockResponse();

            await appointmentController.postAppointment(req, res);

            expect(res.statusCode).toBe(404);
            expect(createAppointment).not.toHaveBeenCalled();
        });

        // Test: checks should return 404 when email belongs to a non-patient account. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return 404 when email belongs to a non-patient account", async () => {

            getUserProfileByEmail.mockResolvedValue({
                uid: "staff-uid",
                role: "staff",
                email: "staff@example.com",
            });

            const req = httpMocks.createRequest({
                body: {
                    patientEmail: "staff@example.com",
                    date: "2026-05-20",
                    timeSlot: "10:00",
                    serviceId: "service1",
                    serviceName: "Consultation",
                    serviceDuration: 30,
                },
            });

            const res = mockResponse();

            await appointmentController.postAppointment(req, res);

            expect(res.statusCode).toBe(404);
            expect(createAppointment).not.toHaveBeenCalled();
        });

        // Test: checks should use clinic metadata when appointment request omits clinic display fields. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should use clinic metadata when appointment request omits clinic display fields", async () => {

            db.collection.mockReturnValue({
                doc: () => ({
                    get: jest.fn().mockResolvedValue({
                        exists: true,
                        data: () => ({
                            clinicName: "Metadata Clinic",
                            address: "Metadata Address",
                        }),
                    }),
                }),
            });

            createAppointment.mockResolvedValue({
                id: "appointment1",
            });

            getPatientProfileById.mockResolvedValue(null);

            const req = httpMocks.createRequest({
                body: {
                    patientId: "patient1",
                    clinicId: "clinic1",
                    date: "2026-05-20",
                    timeSlot: "10:00",
                    serviceId: "service1",
                    serviceName: "Consultation",
                    serviceDuration: 30,
                },
            });

            const res = mockResponse();

            await appointmentController.postAppointment(req, res);

            expect(res.statusCode).toBe(200);
            expect(createAppointment).toHaveBeenCalledWith(
                "clinic1",
                "2026-05-20",
                "10:00",
                "patient1",
                "Metadata Clinic",
                "Metadata Address",
                false,
                "service1",
                "Consultation",
                30
            );
        });

        // Test: checks should fall back when clinic metadata is unavailable. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should fall back when clinic metadata is unavailable", async () => {

            db.collection.mockReturnValue({
                doc: () => ({
                    get: jest.fn().mockResolvedValue({
                        exists: false,
                    }),
                }),
            });

            createAppointment.mockResolvedValue({
                id: "appointment1",
            });

            getPatientProfileById.mockResolvedValue(null);

            const req = httpMocks.createRequest({
                body: {
                    patientId: "patient1",
                    clinicId: "missing-clinic",
                    date: "2026-05-20",
                    timeSlot: "10:00",
                    serviceId: "service1",
                    serviceName: "Consultation",
                    serviceDuration: 30,
                },
            });

            const res = mockResponse();

            await appointmentController.postAppointment(req, res);

            expect(res.statusCode).toBe(200);
            expect(createAppointment).toHaveBeenCalledWith(
                "missing-clinic",
                "2026-05-20",
                "10:00",
                "patient1",
                "Unknown Clinic",
                "N/A",
                false,
                "service1",
                "Consultation",
                30
            );
        });

        // Test: checks should still create appointment when confirmation email fails. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should still create appointment when confirmation email fails", async () => {

            createAppointment.mockResolvedValue({
                id: "appointment1",
            });

            getPatientProfileById.mockResolvedValue({
                email: "test@example.com",
                fullName: "John Doe",
            });

            emailService.sendAppointmentConfirmation.mockRejectedValue(new Error("Email failed"));

            const req = httpMocks.createRequest({
                body: {
                    patientId: "patient1",
                    clinicId: "clinic1",
                    date: "2026-05-20",
                    timeSlot: "10:00",
                    clinicName: "Clinic A",
                    clinicAddress: "Address A",
                    serviceId: "service1",
                    serviceName: "Consultation",
                    serviceDuration: 30,
                },
            });

            const res = mockResponse();

            await appointmentController.postAppointment(req, res);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
        });

        // Test: checks should use default clinic labels when no clinic id is supplied. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should use default clinic labels when no clinic id is supplied", async () => {

            createAppointment.mockResolvedValue({
                id: "appointment1",
            });

            getPatientProfileById.mockResolvedValue(null);

            const req = httpMocks.createRequest({
                body: {
                    patientId: "patient1",
                    date: "2026-05-20",
                    timeSlot: "10:00",
                    serviceId: "service1",
                    serviceName: "Consultation",
                    serviceDuration: 30,
                },
            });

            const res = mockResponse();

            await appointmentController.postAppointment(req, res);

            expect(res.statusCode).toBe(200);
            expect(createAppointment).toHaveBeenCalledWith(
                undefined,
                "2026-05-20",
                "10:00",
                "patient1",
                "Unknown Clinic",
                "N/A",
                false,
                "service1",
                "Consultation",
                30
            );
        });

        // Test: checks should return 400 when patient id and email are missing. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return 400 when patient id and email are missing", async () => {

            const req = httpMocks.createRequest({
                body: {
                    date: "2026-05-20",
                    timeSlot: "10:00",
                    serviceId: "service1",
                    serviceName: "Consultation",
                    serviceDuration: 30,
                },
            });

            const res = mockResponse();

            await appointmentController.postAppointment(req, res);

            expect(res.statusCode).toBe(400);
        });

        // Test: checks should cancel old appointment and delete its queue item during reschedule. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should cancel old appointment and delete its queue item during reschedule", async () => {

            cancelAppointment.mockResolvedValue();

            createAppointment.mockResolvedValue({
                id: "newAppointment",
            });

            getPatientProfileById.mockResolvedValue(null);
            const queueItemDelete = jest.fn().mockResolvedValue();
            const queueItemGet = jest.fn().mockResolvedValue({ exists: true });
            const appointmentsDoc = jest.fn(() => ({
                get: jest.fn().mockResolvedValue({
                    exists: true,
                    data: () => ({
                        clinicId: "clinic1",
                        date: "2026-05-19",
                    }),
                }),
            }));
            const queueItemsDoc = jest.fn(() => ({
                get: queueItemGet,
                delete: queueItemDelete,
            }));

            db.collection.mockImplementation((collectionName) => {
                if (collectionName === "appointments") {
                    return { doc: appointmentsDoc };
                }

                if (collectionName === "clinics") {
                    return {
                        doc: jest.fn(() => ({
                            collection: jest.fn(() => ({
                                doc: jest.fn(() => ({
                                    collection: jest.fn(() => ({
                                        doc: queueItemsDoc,
                                    })),
                                })),
                            })),
                        })),
                    };
                }

                return {};
            });

            const req = httpMocks.createRequest({
                body: {
                    patientId: "patient1",
                    clinicId: "clinic1",
                    date: "2026-05-20",
                    timeSlot: "10:00",
                    clinicName: "Clinic A",
                    clinicAddress: "Address A",
                    serviceId: "service1",
                    serviceName: "Consultation",
                    serviceDuration: 30,
                    oldAppointmentId: "old123",
                },
            });

            const res = mockResponse();

            await appointmentController.postAppointment(req, res);

            expect(cancelAppointment)
                .toHaveBeenCalledWith("old123");
            expect(appointmentsDoc).toHaveBeenCalledWith("old123");
            expect(queueItemsDoc).toHaveBeenCalledWith("old123");
            expect(queueItemGet).toHaveBeenCalled();
            expect(queueItemDelete).toHaveBeenCalled();
        });

        // Test: checks should return 400 for slot full error. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return 400 for slot full error", async () => {

            createAppointment.mockRejectedValue(
                new Error("slot is full")
            );

            const req = httpMocks.createRequest({
                body: {
                    patientId: "patient1",
                    clinicId: "clinic1",
                    date: "2026-05-20",
                    timeSlot: "10:00",
                    clinicName: "Clinic A",
                    clinicAddress: "Address A",
                    serviceId: "service1",
                    serviceName: "Consultation",
                    serviceDuration: 30,
                },
            });

            const res = mockResponse();

            await appointmentController.postAppointment(req, res);

            expect(res.statusCode).toBe(400);
        });

        // Test: checks should return 500 for unexpected appointment creation errors. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return 500 for unexpected appointment creation errors", async () => {

            createAppointment.mockRejectedValue(
                new Error("Unexpected database error")
            );

            const req = httpMocks.createRequest({
                body: {
                    patientId: "patient1",
                    clinicId: "clinic1",
                    date: "2026-05-20",
                    timeSlot: "10:00",
                    clinicName: "Clinic A",
                    clinicAddress: "Address A",
                    serviceId: "service1",
                    serviceName: "Consultation",
                    serviceDuration: 30,
                },
            });

            const res = mockResponse();

            await appointmentController.postAppointment(req, res);

            expect(res.statusCode).toBe(500);
        });
    });

    // =====================================================
    // getAppointmentsByPatientId
    // =====================================================

    // Suite: groups related coverage for getAppointmentsByPatientId.
    describe("getAppointmentsByPatientId", () => {

        // Test: checks should fetch appointments. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should fetch appointments", async () => {

            getAppointmentsByPatientId.mockResolvedValue([
                {
                    id: "appointment1",
                },
            ]);

            const req = httpMocks.createRequest({
                params: {
                    patientId: "patient1",
                },
            });

            const res = mockResponse();

            await appointmentController.getAppointmentsByPatientId(req, res);

            expect(res.statusCode).toBe(200);

            expect(getAppointmentsByPatientId)
                .toHaveBeenCalledWith("patient1");
        });

        // Test: checks should return 400 if patientId missing. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return 400 if patientId missing", async () => {

            const req = httpMocks.createRequest({
                params: {},
            });

            const res = mockResponse();

            await appointmentController.getAppointmentsByPatientId(req, res);

            expect(res.statusCode).toBe(400);
        });

        // Test: checks should return 500 if fetching appointments fails. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return 500 if fetching appointments fails", async () => {

            getAppointmentsByPatientId.mockRejectedValue(new Error("Fetch failed"));

            const req = httpMocks.createRequest({
                params: {
                    patientId: "patient1",
                },
            });

            const res = mockResponse();

            await appointmentController.getAppointmentsByPatientId(req, res);

            expect(res.statusCode).toBe(500);
        });
    });

    // =====================================================
    // cancelAppointmentController
    // =====================================================

    // Suite: groups related coverage for cancelAppointmentController.
    describe("cancelAppointmentController", () => {

        // Test: checks should cancel appointment successfully. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should cancel appointment successfully", async () => {

            const mockGet = jest.fn().mockResolvedValue({
                exists: true,
                data: () => ({
                    patientId: "patient1",
                    clinicId: "clinic1",
                    clinicName: "Clinic A",
                    clinicAddress: "Address A",
                    date: "2026-05-20",
                    timeSlot: "10:00",
                }),
            });

            admin.firestore.mockReturnValue({
                collection: jest.fn(() => ({
                    doc: jest.fn(() => ({
                        get: mockGet,
                    })),
                })),
            });

            cancelAppointment.mockResolvedValue({
                message: "Appointment cancelled",
            });

            getPatientProfileById.mockResolvedValue({
                email: "test@example.com",
                fullName: "John Doe",
            });

            emailService.sendAppointmentCancellation
                .mockResolvedValue();

            const queueItemDelete = jest.fn().mockResolvedValue();
            const queueItemGet = jest.fn().mockResolvedValue({ exists: true });
            const queueItemsDoc = jest.fn(() => ({
                get: queueItemGet,
                delete: queueItemDelete,
            }));

            db.collection.mockImplementation((collectionName) => {
                if (collectionName === "clinics") {
                    return {
                        doc: jest.fn(() => ({
                            collection: jest.fn(() => ({
                                doc: jest.fn(() => ({
                                    collection: jest.fn(() => ({
                                        doc: queueItemsDoc,
                                    })),
                                })),
                            })),
                        })),
                    };
                }

                return {};
            });

            const req = httpMocks.createRequest({
                params: {
                    id: "appointment1",
                },
            });

            const res = mockResponse();

            await appointmentController.cancelAppointmentController(req, res);

            expect(res.statusCode).toBe(200);

            expect(cancelAppointment)
                .toHaveBeenCalledWith("appointment1");

            expect(emailService.sendAppointmentCancellation)
                .toHaveBeenCalled();

            expect(queueItemsDoc)
                .toHaveBeenCalledWith("appointment1");
            expect(queueItemGet)
                .toHaveBeenCalled();
            expect(queueItemDelete)
                .toHaveBeenCalled();
        });

        // Test: checks should return 400 if appointment id missing. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return 400 if appointment id missing", async () => {

            const req = httpMocks.createRequest({
                params: {},
            });

            const res = mockResponse();

            await appointmentController.cancelAppointmentController(req, res);

            expect(res.statusCode).toBe(400);
        });

        // Test: checks should still succeed if cancellation email fails. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should still succeed if cancellation email fails", async () => {

            const mockGet = jest.fn().mockResolvedValue({
                exists: true,
                data: () => ({
                    patientId: "patient1",
                    clinicName: "Clinic A",
                    clinicAddress: "Address A",
                    date: "2026-05-20",
                    timeSlot: "10:00",
                }),
            });

            admin.firestore.mockReturnValue({
                collection: jest.fn(() => ({
                    doc: jest.fn(() => ({
                        get: mockGet,
                    })),
                })),
            });

            cancelAppointment.mockResolvedValue({
                message: "Appointment cancelled",
            });

            getPatientProfileById.mockResolvedValue({
                email: "test@example.com",
                fullName: "John Doe",
            });

            emailService.sendAppointmentCancellation
                .mockRejectedValue(new Error("Email failed"));

            const req = httpMocks.createRequest({
                params: {
                    id: "appointment1",
                },
            });

            const res = mockResponse();

            await appointmentController.cancelAppointmentController(req, res);

            expect(res.statusCode).toBe(200);
        });

        // Test: checks should return 500 if cancellation fails. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return 500 if cancellation fails", async () => {

            admin.firestore.mockReturnValue({
                collection: jest.fn(() => ({
                    doc: jest.fn(() => ({
                        get: jest.fn().mockResolvedValue({
                            exists: false,
                        }),
                    })),
                })),
            });

            cancelAppointment.mockRejectedValue(new Error("Cancel failed"));

            const req = httpMocks.createRequest({
                params: {
                    id: "appointment1",
                },
            });

            const res = mockResponse();

            await appointmentController.cancelAppointmentController(req, res);

            expect(res.statusCode).toBe(500);
        });
    });

    // =====================================================
    // getSmartSuggestion
    // =====================================================

    // Suite: groups related coverage for getSmartSuggestion.
    describe("getSmartSuggestion", () => {

        // Test: checks should return smart suggestions. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return smart suggestions", async () => {

            process.env.ML_SERVICE_URL = "http://localhost:5000";

            fetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    predictionsByDate: {
                        "2026-05-18": [
                            {
                                recommended: true,
                                timeSlot: "10:00",
                            },
                        ],
                    },
                }),
            });

            const req = httpMocks.createRequest({
                query: {
                    clinicId: "clinic1",
                },
            });

            const res = mockResponse();

            await appointmentController.getSmartSuggestion(req, res);

            expect(res.statusCode).toBe(200);
        });

        // Test: checks should return smart suggestions with only future recommendations. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return smart suggestions with only future recommendations", async () => {
            process.env.ML_SERVICE_URL = "http://localhost:5000";

            // Force bestFuture match by providing a future date
            const futureDateStr = "2026-09-09";

            fetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    predictionsByDate: {
                        [futureDateStr]: [
                            {
                                recommended: true,
                                timeSlot: "11:00",
                            },
                        ],
                    },
                }),
            });

            const req = httpMocks.createRequest({
                query: {
                    clinicId: "clinic1",
                },
            });

            const res = mockResponse();

            await appointmentController.getSmartSuggestion(req, res);

            expect(res.statusCode).toBe(200);
            expect(res.body.hasPrediction).toBe(true);
            expect(res.body.future).toBeDefined();
        });

        // Test: checks should return fallback message if no recommendations are found. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return fallback message if no recommendations are found", async () => {
            process.env.ML_SERVICE_URL = "http://localhost:5000";

            fetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    predictionsByDate: {
                        "2026-05-18": [
                            {
                                recommended: false,
                                timeSlot: "10:00",
                            },
                        ],
                    },
                }),
            });

            const req = httpMocks.createRequest({
                query: {
                    clinicId: "clinic1",
                },
            });

            const res = mockResponse();

            await appointmentController.getSmartSuggestion(req, res);

            expect(res.statusCode).toBe(200);
            expect(res.body.hasPrediction).toBe(false);
            expect(res.body.suggestion).toContain("Traffic models suggest normal volume");
        });

        // Test: checks should return fallback suggestion if ML service missing. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return fallback suggestion if ML service missing", async () => {

            delete process.env.ML_SERVICE_URL;

            const req = httpMocks.createRequest({});

            const res = mockResponse();

            await appointmentController.getSmartSuggestion(req, res);

            expect(res.statusCode).toBe(200);
        });

        // Test: checks should return fallback suggestion on ML error. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return fallback suggestion on ML error", async () => {

            process.env.ML_SERVICE_URL = "http://localhost:5000";

            fetch.mockRejectedValue(new Error("ML Error"));

            const req = httpMocks.createRequest({});

            const res = mockResponse();

            await appointmentController.getSmartSuggestion(req, res);

            expect(res.statusCode).toBe(200);
        });

        // Test: checks should return no-prediction response when ML has no recommendations. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return no-prediction response when ML has no recommendations", async () => {

            process.env.ML_SERVICE_URL = "http://localhost:5000";

            fetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    predictionsByDate: {},
                }),
            });

            const req = httpMocks.createRequest({});

            const res = mockResponse();

            await appointmentController.getSmartSuggestion(req, res);

            expect(res.statusCode).toBe(200);
            expect(res.body.hasPrediction).toBe(false);
        });

        // Test: checks should return a future smart suggestion when a later date is recommended. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should return a future smart suggestion when a later date is recommended", async () => {

            process.env.ML_SERVICE_URL = "http://localhost:5000";

            fetch.mockResolvedValue({
                ok: true,
                json: async () => ({
                    predictionsByDate: {
                        "2099-01-02": [
                            {
                                recommended: true,
                                timeSlot: "09:00",
                            },
                        ],
                    },
                }),
            });

            const req = httpMocks.createRequest({
                query: {
                    clinicId: "clinic1",
                },
            });

            const res = mockResponse();

            await appointmentController.getSmartSuggestion(req, res);

            expect(res.statusCode).toBe(200);
            expect(res.body.hasPrediction).toBe(true);
            expect(res.body.future.time).toBe("09:00");
        });
    });
});
