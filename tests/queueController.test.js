const queueService = require("../services/queueService");
const {
    getQueue,
    startConsultation,
    completeConsultation,
    addQueueItem,
    getAvailableQueueSlots,
    rescheduleQueueItem,
    updateQueueItemStatus,
    removeQueueItem,
    predictWaitTime,
} = require("../Controllers/queueController");

jest.mock("../services/queueService");
jest.mock("../services/emailService", () => ({
    sendQueueStatusUpdate: jest.fn(),
}));

const emailService = require("../services/emailService");

describe("Queue Controllers", () => {
    let req, res;
    let consoleErrorSpy;
    let consoleWarnSpy;

    beforeEach(() => {
        req = { params: {}, body: {}, query: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();
        // Spy on console to keep test output clean during error tests
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        consoleWarnSpy.mockRestore();
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

            queueService.getQueue.mockResolvedValue(mockQueue);

            await getQueue(req, res);

            expect(queueService.getQueue).toHaveBeenCalledWith("clinic1");
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ queue: mockQueue })
            );
        });

        it("should return 500 when service throws", async () => {
            req.params = { clinicId: "clinic1" };
            queueService.getQueue.mockRejectedValue(new Error("Firestore error"));

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

            queueService.startConsultation.mockResolvedValue(mockUpdated);

            await startConsultation(req, res);

            expect(queueService.startConsultation).toHaveBeenCalledWith(
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

            queueService.startConsultation.mockRejectedValue(
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

            queueService.startConsultation.mockRejectedValue(new Error("Firestore error"));

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
        it("should return 400 if staff already has a patient IN_CONSULTATION", async () => {
            req.params = { clinicId: "clinic1" };
            req.body = { queueItemId: "q1", staffId: "staff1" };

            queueService.startConsultation.mockRejectedValue(
                new Error("Staff member already has a patient IN_CONSULTATION")
            );

            await startConsultation(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: "Invalid status transition",
                    error: "Staff member already has a patient IN_CONSULTATION",
                })
            );
        });

        it("should return 200 and include the next patient when one exists", async () => {
            req.params = { clinicId: "clinic1" };
            req.body = { queueItemId: "q2", staffId: "staff1" };

            const mockResult = {
                completed: { queueItemId: "q2", status: "COMPLETE" },
                nextPatient: { queueItemId: "q3", status: "WAITING", queueNumber: 3 },
            };

            queueService.completeConsultation.mockResolvedValue(mockResult);

            await completeConsultation(req, res);

            expect(queueService.completeConsultation).toHaveBeenCalledWith(
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

            queueService.completeConsultation.mockResolvedValue(mockResult);

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

            queueService.completeConsultation.mockRejectedValue(
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

            queueService.completeConsultation.mockRejectedValue(new Error("Firestore error"));

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

    describe("addQueueItem", () => {
        it("should return 400 if clinicId is missing", async () => {
            await addQueueItem(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "clinicId is required" }));
        });

        it("should return 201 when queue item is added", async () => {
            req.params = { clinicId: "clinic1" };
            req.body = { patientName: "Alice" };
            queueService.addQueueItem.mockResolvedValue({ queueItemId: "q1" });

            await addQueueItem(req, res);

            expect(queueService.addQueueItem).toHaveBeenCalledWith("clinic1", req.body);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                queueItem: { queueItemId: "q1" }
            }));
        });

        it("should return 400 for known validation errors", async () => {
            req.params = { clinicId: "clinic1" };
            queueService.addQueueItem.mockRejectedValue(new Error("This slot is full."));

            await addQueueItem(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "This slot is full." }));
        });

        it("should return 500 for unexpected add errors", async () => {
            req.params = { clinicId: "clinic1" };
            queueService.addQueueItem.mockRejectedValue(new Error("Firestore error"));

            await addQueueItem(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: "Failed to add patient to queue",
                error: "Firestore error"
            }));
        });
    });

    describe("getAvailableQueueSlots", () => {
        it("should return 400 if clinicId is missing", async () => {
            await getAvailableQueueSlots(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "clinicId is required" }));
        });

        it("should return slots from the service", async () => {
            req.params = { clinicId: "clinic1" };
            req.query = { date: "2026-05-11", queueItemId: "q1" };
            queueService.getAvailableQueueSlots.mockResolvedValue([{ time: "09:00 - 10:00" }]);

            await getAvailableQueueSlots(req, res);

            expect(queueService.getAvailableQueueSlots).toHaveBeenCalledWith("clinic1", "2026-05-11", "q1");
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                slots: [{ time: "09:00 - 10:00" }]
            }));
        });

        it("should return 500 if slot lookup fails", async () => {
            req.params = { clinicId: "clinic1" };
            queueService.getAvailableQueueSlots.mockRejectedValue(new Error("Firestore error"));

            await getAvailableQueueSlots(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: "Failed to fetch available queue slots",
                error: "Firestore error"
            }));
        });
    });

    describe("rescheduleQueueItem", () => {
        it("should validate required request values", async () => {
            await rescheduleQueueItem(req, res);
            expect(res.status).toHaveBeenLastCalledWith(400);
            expect(res.json).toHaveBeenLastCalledWith(expect.objectContaining({ message: "clinicId is required" }));

            jest.clearAllMocks();
            req.params = { clinicId: "clinic1" };
            await rescheduleQueueItem(req, res);
            expect(res.status).toHaveBeenLastCalledWith(400);
            expect(res.json).toHaveBeenLastCalledWith(expect.objectContaining({ message: "queueItemId is required" }));

            jest.clearAllMocks();
            req.params = { clinicId: "clinic1", queueItemId: "q1" };
            req.body = {};
            await rescheduleQueueItem(req, res);
            expect(res.status).toHaveBeenLastCalledWith(400);
            expect(res.json).toHaveBeenLastCalledWith(expect.objectContaining({ message: "timeSlot is required" }));
        });

        it("should return the rescheduled queue item", async () => {
            req.params = { clinicId: "clinic1", queueItemId: "q1" };
            req.body = { timeSlot: "10:00 - 11:00", staffId: "staff1" };
            queueService.rescheduleQueueItem.mockResolvedValue({ queueItemId: "q1", timeSlot: "10:00 - 11:00" });

            await rescheduleQueueItem(req, res);

            expect(queueService.rescheduleQueueItem).toHaveBeenCalledWith("clinic1", "q1", "10:00 - 11:00", "staff1");
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                queueItem: { queueItemId: "q1", timeSlot: "10:00 - 11:00" }
            }));
        });

        it("should return 400 for known reschedule errors", async () => {
            req.params = { clinicId: "clinic1", queueItemId: "q1" };
            req.body = { timeSlot: "10:00 - 11:00" };
            queueService.rescheduleQueueItem.mockRejectedValue(new Error("Queue item not found"));

            await rescheduleQueueItem(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Queue item not found" }));
        });

        it("should return 500 for unexpected reschedule errors", async () => {
            req.params = { clinicId: "clinic1", queueItemId: "q1" };
            req.body = { timeSlot: "10:00 - 11:00" };
            queueService.rescheduleQueueItem.mockRejectedValue(new Error("Firestore error"));

            await rescheduleQueueItem(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: "Failed to reschedule queue item",
                error: "Firestore error"
            }));
        });
    });

    describe("updateQueueItemStatus", () => {
        it("should validate required request values", async () => {
            await updateQueueItemStatus(req, res);
            expect(res.status).toHaveBeenLastCalledWith(400);
            expect(res.json).toHaveBeenLastCalledWith(expect.objectContaining({ message: "clinicId is required" }));

            jest.clearAllMocks();
            req.params = { clinicId: "clinic1" };
            await updateQueueItemStatus(req, res);
            expect(res.status).toHaveBeenLastCalledWith(400);
            expect(res.json).toHaveBeenLastCalledWith(expect.objectContaining({ message: "queueItemId is required" }));

            jest.clearAllMocks();
            req.params = { clinicId: "clinic1", queueItemId: "q1" };
            req.body = {};
            await updateQueueItemStatus(req, res);
            expect(res.status).toHaveBeenLastCalledWith(400);
            expect(res.json).toHaveBeenLastCalledWith(expect.objectContaining({ message: "status is required" }));
        });

        it("should return the updated queue item", async () => {
            req.params = { clinicId: "clinic1", queueItemId: "q1" };
            req.body = { status: "MISSED", updatedBy: "staff1" };
            queueService.updateQueueItemStatus.mockResolvedValue({
                queueItemId: "q1",
                status: "MISSED",
                patientEmail: "patient@test.com",
                patientName: "Patient One",
                clinicName: "Clinic A",
                date: "2026-05-20",
                timeSlot: "10:00 - 11:00",
            });
            emailService.sendQueueStatusUpdate.mockResolvedValue();

            await updateQueueItemStatus(req, res);

            expect(queueService.updateQueueItemStatus).toHaveBeenCalledWith("clinic1", "q1", "MISSED", "staff1");
            expect(emailService.sendQueueStatusUpdate).toHaveBeenCalledWith(
                "patient@test.com",
                "Patient One",
                "Clinic A",
                "MISSED",
                "2026-05-20",
                "10:00 - 11:00"
            );
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                queueItem: expect.objectContaining({ queueItemId: "q1", status: "MISSED" })
            }));
        });

        it("should still update status if queue email fails", async () => {
            req.params = { clinicId: "clinic1", queueItemId: "q1" };
            req.body = { status: "IN_CONSULTATION", updatedBy: "staff1" };
            queueService.updateQueueItemStatus.mockResolvedValue({
                queueItemId: "q1",
                status: "IN_CONSULTATION",
                patientEmail: "patient@test.com",
                patientName: "Patient One",
            });
            emailService.sendQueueStatusUpdate.mockRejectedValue(new Error("SMTP down"));

            await updateQueueItemStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                queueItem: expect.objectContaining({ status: "IN_CONSULTATION" })
            }));
        });

        it("should return 400 for known status errors", async () => {
            req.params = { clinicId: "clinic1", queueItemId: "q1" };
            req.body = { status: "UNKNOWN" };
            queueService.updateQueueItemStatus.mockRejectedValue(new Error("Invalid queue status"));

            await updateQueueItemStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Invalid queue status" }));
        });

        it("should return 500 for unexpected status errors", async () => {
            req.params = { clinicId: "clinic1", queueItemId: "q1" };
            req.body = { status: "WAITING" };
            queueService.updateQueueItemStatus.mockRejectedValue(new Error("Firestore error"));

            await updateQueueItemStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: "Failed to update queue item status",
                error: "Firestore error"
            }));
        });
    });

    describe("removeQueueItem", () => {
        it("should validate required request values", async () => {
            await removeQueueItem(req, res);
            expect(res.status).toHaveBeenLastCalledWith(400);
            expect(res.json).toHaveBeenLastCalledWith(expect.objectContaining({ message: "clinicId is required" }));

            jest.clearAllMocks();
            req.params = { clinicId: "clinic1" };
            await removeQueueItem(req, res);
            expect(res.status).toHaveBeenLastCalledWith(400);
            expect(res.json).toHaveBeenLastCalledWith(expect.objectContaining({ message: "queueItemId is required" }));
        });

        it("should remove a queue item", async () => {
            req.params = { clinicId: "clinic1", queueItemId: "q1" };
            queueService.removeQueueItem.mockResolvedValue({ queueItemId: "q1" });

            await removeQueueItem(req, res);

            expect(queueService.removeQueueItem).toHaveBeenCalledWith("clinic1", "q1");
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                queueItem: { queueItemId: "q1" }
            }));
        });

        it("should return 404 for missing queue items", async () => {
            req.params = { clinicId: "clinic1", queueItemId: "q1" };
            queueService.removeQueueItem.mockRejectedValue(new Error("Queue item not found"));

            await removeQueueItem(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: "Queue item not found" }));
        });

        it("should return 500 for unexpected remove errors", async () => {
            req.params = { clinicId: "clinic1", queueItemId: "q1" };
            queueService.removeQueueItem.mockRejectedValue(new Error("Firestore error"));

            await removeQueueItem(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: "Failed to remove queue item",
                error: "Firestore error"
            }));
        });
    });

    describe("predictWaitTime", () => {
        it("should return 400 if clinicId is missing", async () => {
            req.params = {};

            await predictWaitTime(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({ message: "clinicId is required" })
            );
        });

        it("should calculate wait time using DB fallback heuristics if ML service is down", async () => {
            req.params = { clinicId: "clinic1" };
            req.query = { date: "2026-05-11", timeSlot: "09:00" };

            const mockQueue = {
                WAITING: [{ id: "q1" }, { id: "q2" }],
                IN_CONSULTATION: [{ id: "q3" }],
                COMPLETE: [],
                MISSED: [],
            };

            queueService.getQueue.mockResolvedValue(mockQueue);

            await predictWaitTime(req, res);

            expect(queueService.getQueue).toHaveBeenCalledWith("clinic1");
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    estimatedWaitTime: 40, // (1 active * 10) + (2 waiting * 15) = 40
                    waitTimeRange: "35-45 mins",
                    fallback: true
                })
            );
        });

        it("should handle error in getQueue gracefully", async () => {
            req.params = { clinicId: "clinic1" };
            queueService.getQueue.mockRejectedValue(new Error("Database down"));

            await predictWaitTime(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: "Failed to predict wait time",
                    error: "Database down"
                })
            );
        });

        it("should return predictions from ML service if it is running", async () => {
            const originalMlUrl = process.env.ML_SERVICE_URL;
            const originalFetch = global.fetch;
            
            process.env.ML_SERVICE_URL = "http://localhost:5001";
            
            const mockResponse = {
                success: true,
                estimatedWaitTime: 25,
                waitTimeRange: "20-30 mins",
                usedLiveQueue: true,
                isToday: true
            };
            
            global.fetch = jest.fn().mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue(mockResponse)
            });

            req.params = { clinicId: "clinic1" };
            req.query = { date: "2026-05-11", timeSlot: "09:00" };

            await predictWaitTime(req, res);

            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining("http://localhost:5001/predict-waittime"),
                expect.any(Object)
            );
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    estimatedWaitTime: 25,
                    waitTimeRange: "20-30 mins"
                })
            );

            process.env.ML_SERVICE_URL = originalMlUrl;
            global.fetch = originalFetch;
        });

        it("should fallback to DB heuristics if ML service returns not ok", async () => {
            const originalMlUrl = process.env.ML_SERVICE_URL;
            const originalFetch = global.fetch;
            
            process.env.ML_SERVICE_URL = "http://localhost:5001";
            
            global.fetch = jest.fn().mockResolvedValue({
                ok: false
            });

            req.params = { clinicId: "clinic1" };
            req.query = { date: "2026-05-11", timeSlot: "09:00" };

            const mockQueue = {
                WAITING: [{ id: "q1" }],
                IN_CONSULTATION: [],
                COMPLETE: [],
                MISSED: [],
            };
            queueService.getQueue.mockResolvedValue(mockQueue);

            await predictWaitTime(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    estimatedWaitTime: 15,
                    fallback: true
                })
            );

            process.env.ML_SERVICE_URL = originalMlUrl;
            global.fetch = originalFetch;
        });
    });
});
