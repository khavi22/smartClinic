const firebaseService = require("../services/firebaseService");
const {
    getQueue,
    startConsultation,
    completeConsultation,
} = require("../Controllers/queueController");

jest.mock("../services/firebaseService");

describe("Queue Controllers", () => {
    let req, res;

    beforeEach(() => {
        req = { params: {}, body: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();
    });

    // ─────────────────────────────────────────────
    // getQueue
    // ─────────────────────────────────────────────
    describe("getQueue", () => {
        it("should return 400 if clinicId is missing", async () => {
            req.params = {};

            await getQueue(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ message: "clinicId is required" })
            );
        });

        it("should return 200 with queue data when service succeeds", async () => {
            req.params = { clinicId: "clinic1" };

            const mockQueue = {
                WAITING: [
                    { queueItemId: "q1", fullName: "Alice", status: "WAITING", queueNumber: 1 },
                ],
                IN_CONSULTATION: [
                    { queueItemId: "q2", fullName: "Bob", status: "IN_CONSULTATION", queueNumber: 2 },
                ],
                COMPLETE: [],
                MISSED: [],
            };

            firebaseService.getQueue.mockResolvedValue(mockQueue);

            await getQueue(req, res);

            expect(firebaseService.getQueue).toHaveBeenCalledWith("clinic1");
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ queue: mockQueue })
            );
        });

        it("should return 500 when service throws", async () => {
            req.params = { clinicId: "clinic1" };
            firebaseService.getQueue.mockRejectedValue(new Error("Firestore error"));

            await getQueue(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: "Failed to fetch queue",
                    error: "Firestore error",
                })
            );
        });
    });

    // ─────────────────────────────────────────────
    // startConsultation
    // ─────────────────────────────────────────────
    describe("startConsultation", () => {
        it("should return 400 if clinicId is missing", async () => {
            req.params = {};
            req.body = { queueItemId: "q1", staffId: "staff1" };

            await startConsultation(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ message: "clinicId is required" })
            );
        });

        it("should return 400 if queueItemId is missing", async () => {
            req.params = { clinicId: "clinic1" };
            req.body = { staffId: "staff1" };

            await startConsultation(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ message: "queueItemId is required" })
            );
        });

        it("should return 400 if staffId is missing", async () => {
            req.params = { clinicId: "clinic1" };
            req.body = { queueItemId: "q1" };

            await startConsultation(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ message: "staffId is required" })
            );
        });

        it("should return 200 when patient is moved to IN_CONSULTATION", async () => {
            req.params = { clinicId: "clinic1" };
            req.body = { queueItemId: "q1", staffId: "staff1" };

            const mockUpdated = {
                queueItemId: "q1",
                status: "IN_CONSULTATION",
                assignedStaffId: "staff1",
            };

            firebaseService.startConsultation.mockResolvedValue(mockUpdated);

            await startConsultation(req, res);

            expect(firebaseService.startConsultation).toHaveBeenCalledWith(
                "clinic1",
                "q1",
                "staff1"
            );
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ queueItem: mockUpdated })
            );
        });

        it("should return 400 if patient is not in WAITING status", async () => {
            req.params = { clinicId: "clinic1" };
            req.body = { queueItemId: "q1", staffId: "staff1" };

            firebaseService.startConsultation.mockRejectedValue(
                new Error("Patient is not in WAITING status")
            );

            await startConsultation(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: "Invalid status transition",
                    error: "Patient is not in WAITING status",
                })
            );
        });

        it("should return 500 when service throws an unexpected error", async () => {
            req.params = { clinicId: "clinic1" };
            req.body = { queueItemId: "q1", staffId: "staff1" };

            firebaseService.startConsultation.mockRejectedValue(new Error("Firestore error"));

            await startConsultation(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: "Failed to start consultation",
                    error: "Firestore error",
                })
            );
        });
    });

    // ─────────────────────────────────────────────
    // completeConsultation
    // ─────────────────────────────────────────────
    describe("completeConsultation", () => {
        it("should return 400 if clinicId is missing", async () => {
            req.params = {};
            req.body = { queueItemId: "q1", staffId: "staff1" };

            await completeConsultation(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ message: "clinicId is required" })
            );
        });

        it("should return 400 if queueItemId is missing", async () => {
            req.params = { clinicId: "clinic1" };
            req.body = { staffId: "staff1" };

            await completeConsultation(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ message: "queueItemId is required" })
            );
        });

        it("should return 400 if staffId is missing", async () => {
            req.params = { clinicId: "clinic1" };
            req.body = { queueItemId: "q1" };

            await completeConsultation(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ message: "staffId is required" })
            );
        });

        it("should return 200 and include the next patient when one exists", async () => {
            req.params = { clinicId: "clinic1" };
            req.body = { queueItemId: "q2", staffId: "staff1" };

            const mockResult = {
                completed: { queueItemId: "q2", status: "COMPLETE" },
                nextPatient: { queueItemId: "q3", status: "WAITING", queueNumber: 3 },
            };

            firebaseService.completeConsultation.mockResolvedValue(mockResult);

            await completeConsultation(req, res);

            expect(firebaseService.completeConsultation).toHaveBeenCalledWith(
                "clinic1",
                "q2",
                "staff1"
            );
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    completed: mockResult.completed,
                    nextPatient: mockResult.nextPatient,
                })
            );
        });

        it("should return 200 with null nextPatient when queue is empty", async () => {
            req.params = { clinicId: "clinic1" };
            req.body = { queueItemId: "q2", staffId: "staff1" };

            const mockResult = {
                completed: { queueItemId: "q2", status: "COMPLETE" },
                nextPatient: null,
            };

            firebaseService.completeConsultation.mockResolvedValue(mockResult);

            await completeConsultation(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    completed: mockResult.completed,
                    nextPatient: null,
                })
            );
        });

        it("should return 400 if patient is not IN_CONSULTATION", async () => {
            req.params = { clinicId: "clinic1" };
            req.body = { queueItemId: "q2", staffId: "staff1" };

            firebaseService.completeConsultation.mockRejectedValue(
                new Error("Patient is not IN_CONSULTATION")
            );

            await completeConsultation(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: "Invalid status transition",
                    error: "Patient is not IN_CONSULTATION",
                })
            );
        });

        it("should return 500 when service throws an unexpected error", async () => {
            req.params = { clinicId: "clinic1" };
            req.body = { queueItemId: "q2", staffId: "staff1" };

            firebaseService.completeConsultation.mockRejectedValue(new Error("Firestore error"));

            await completeConsultation(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: "Failed to complete consultation",
                    error: "Firestore error",
                })
            );
        });
    });
});