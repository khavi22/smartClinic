const mockServerTimestamp = jest.fn(() => "mock-server-timestamp");

jest.mock("../services/config/firebase", () => ({
    db: {
        collection: jest.fn()
    },
    admin: {
        firestore: {
            FieldValue: {
                serverTimestamp: mockServerTimestamp
            }
        }
    }
}));

const queueService = require("../services/queueService");
const { db } = require("../services/config/firebase");

const createSnapshot = (docs) => ({
    empty: docs.length === 0,
    docs,
    forEach: (callback) => docs.forEach(callback)
});

const matchesFilters = (data, filters) =>
    filters.every(({ field, value }) => data[field] === value);

function setupFirestore({
    clinicData = null,
    appointments = [],
    queueItems = [],
    patients = {}
} = {}) {
    const queueItemMap = new Map(queueItems.map((item) => [item.id, { ...item.data }]));
    const queueRefs = {};
    const appointmentRefs = {};
    const appointmentDocs = appointments.map((item) => ({ id: item.id, data: { ...item.data } }));

    const makeDoc = (id, data, ref) => ({
        id,
        ref,
        data: () => data
    });

    const getQueueRef = (id) => {
        if (!queueRefs[id]) {
            queueRefs[id] = {
                get: jest.fn(async () => {
                    const exists = queueItemMap.has(id);
                    const docData = exists ? { ...queueItemMap.get(id) } : undefined;

                    return {
                        exists,
                        data: () => docData
                    };
                }),
                update: jest.fn(async (updates) => {
                    queueItemMap.set(id, {
                        ...(queueItemMap.get(id) || {}),
                        ...updates
                    });
                }),
                delete: jest.fn(async () => {
                    queueItemMap.delete(id);
                }),
                set: jest.fn(async (data) => {
                    queueItemMap.set(id, data);
                })
            };
        }

        return queueRefs[id];
    };

    const makeQueueQuery = (filters = []) => {
        const query = {
            where: jest.fn((field, _operator, value) =>
                makeQueueQuery([...filters, { field, value }])
            ),
            get: jest.fn(async () => {
                const docs = Array.from(queueItemMap.entries())
                    .filter(([, data]) => matchesFilters(data, filters))
                    .map(([id, data]) => makeDoc(id, data, getQueueRef(id)));

                return createSnapshot(docs);
            })
        };

        return query;
    };

    const queueItemsRef = {
        add: jest.fn(async (data) => {
            queueItemMap.set("queue-added", data);
            return { id: "queue-added" };
        }),
        doc: jest.fn((id) => getQueueRef(id)),
        get: jest.fn(async () => {
            const docs = Array.from(queueItemMap.entries()).map(([id, data]) =>
                makeDoc(id, data, getQueueRef(id))
            );
            return createSnapshot(docs);
        }),
        where: jest.fn((field, _operator, value) =>
            makeQueueQuery([{ field, value }])
        )
    };

    const makeAppointmentQuery = (filters = []) => ({
        where: jest.fn((field, _operator, value) =>
            makeAppointmentQuery([...filters, { field, value }])
        ),
        get: jest.fn(async () => {
            const docs = appointmentDocs
                .filter(({ data }) => matchesFilters(data, filters))
                .map(({ id, data }) => makeDoc(id, data));

            return createSnapshot(docs);
        })
    });

    const appointmentsCollection = {
        ...makeAppointmentQuery(),
        doc: jest.fn((id) => {
            if (!appointmentRefs[id]) {
                appointmentRefs[id] = {
                    update: jest.fn(async (updates) => {
                        const appointment = appointmentDocs.find((item) => item.id === id);
                        if (appointment) {
                            appointment.data = { ...appointment.data, ...updates };
                        }
                    })
                };
            }

            return appointmentRefs[id];
        })
    };

    const clinicsCollection = {
        doc: jest.fn(() => ({
            get: jest.fn(async () => ({
                exists: Boolean(clinicData),
                data: () => clinicData
            })),
            collection: jest.fn(() => ({
                doc: jest.fn(() => ({
                    collection: jest.fn(() => queueItemsRef)
                }))
            }))
        }))
    };

    db.collection.mockImplementation((name) => {
        if (name === "clinics") {
            return clinicsCollection;
        }

        if (name === "appointments") {
            return appointmentsCollection;
        }

        if (name === "patients") {
            return {
                doc: jest.fn((id) => ({
                    get: jest.fn(async () => ({
                        exists: Boolean(patients[id]),
                        data: () => patients[id]
                    }))
                }))
            };
        }

        return {};
    });

    return {
        appointmentRefs,
        queueItemsRef,
        queueRefs,
        queueItemMap
    };
}

const mondayHours = {
    operatingHours: {
        monday: { open: "08:00", close: "11:00", isOpen: true }
    }
};

describe("queueService", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        jest.setSystemTime(new Date("2026-05-11T07:50:00"));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe("slot availability", () => {
        it("combines operating hours, appointments, and manual queue counts", async () => {
            setupFirestore({
                clinicData: mondayHours,
                appointments: [
                    { id: "a1", data: { clinicId: "clinic-1", date: "2026-05-11", status: "booked", timeSlot: "08:00 - 09:00" } },
                    ...Array.from({ length: 8 }, (_, index) => ({
                        id: `limited-${index}`,
                        data: { clinicId: "clinic-1", date: "2026-05-11", status: "booked", timeSlot: "09:00 - 10:00" }
                    }))
                ],
                queueItems: [
                    { id: "manual-1", data: { timeSlot: "08:00 - 09:00", status: "WAITING" } },
                    { id: "locked-1", data: { timeSlot: "08:00 - 09:00", status: "COMPLETE" } }
                ]
            });

            const slots = await queueService.getAvailableQueueSlots("clinic-1", "2026-05-11");

            expect(slots).toHaveLength(3);
            expect(slots.map((slot) => slot.time)).toEqual([
                "08:00 - 09:00",
                "09:00 - 10:00",
                "10:00 - 11:00"
            ]);
            expect(slots[0]).toEqual(expect.objectContaining({ taken: 2, status: "available" }));
            expect(slots[1]).toEqual(expect.objectContaining({ taken: 8, status: "limited" }));
        });

        it("filters out stale and full slots", async () => {
            jest.setSystemTime(new Date("2026-05-11T08:20:00"));
            setupFirestore({
                clinicData: {
                    operatingHours: {
                        monday: { open: "08:00", close: "10:00", isOpen: true }
                    }
                },
                appointments: Array.from({ length: 10 }, (_, index) => ({
                    id: `full-${index}`,
                    data: { clinicId: "clinic-1", date: "2026-05-11", status: "booked", timeSlot: "09:00 - 10:00" }
                }))
            });

            await expect(
                queueService.getAvailableQueueSlots("clinic-1", "2026-05-11")
            ).resolves.toEqual([]);
        });
    });

    describe("addQueueItem", () => {
        it("adds a queue item with a normalized requested time", async () => {
            const { queueItemsRef } = setupFirestore({ clinicData: mondayHours });

            const result = await queueService.addQueueItem("clinic-1", {
                patientName: " Alice ",
                priority: "2",
                timeSlot: "09:35",
                addedBy: "staff-1"
            });

            expect(result).toEqual(expect.objectContaining({
                queueItemId: "queue-added",
                patientName: "Alice",
                priority: 2,
                timeSlot: "09:00 - 10:00",
                status: "WAITING",
                addedBy: "staff-1"
            }));
            expect(queueItemsRef.add).toHaveBeenCalledWith(expect.objectContaining({
                appointmentTime: "09:00 - 10:00",
                createdAt: "mock-server-timestamp"
            }));
        });

        it("requires either patientName or patientId", async () => {
            setupFirestore({ clinicData: mondayHours });

            await expect(
                queueService.addQueueItem("clinic-1", { patientName: "   " })
            ).rejects.toThrow("patientName or patientId is required");
        });

        it("includes service metadata when provided", async () => {
            const { queueItemsRef } = setupFirestore({ clinicData: mondayHours });

            const result = await queueService.addQueueItem("clinic-1", {
                patientName: "Alice",
                timeSlot: "09:35",
                serviceId: "service-1",
                serviceName: "General Consultation",
                serviceDuration: 30
            });

            expect(result).toEqual(expect.objectContaining({
                queueItemId: "queue-added",
                serviceId: "service-1",
                serviceName: "General Consultation",
                serviceDuration: 30
            }));
            expect(queueItemsRef.add).toHaveBeenCalledWith(expect.objectContaining({
                serviceId: "service-1",
                serviceName: "General Consultation",
                serviceDuration: 30
            }));
        });

        it("rejects requested slots outside operating hours", async () => {
            setupFirestore({ clinicData: mondayHours });

            await expect(
                queueService.addQueueItem("clinic-1", {
                    patientName: "Alice",
                    timeSlot: "07:00 - 08:00"
                })
            ).rejects.toThrow("Selected time is outside clinic operating hours.");
        });

        it("rejects full requested slots", async () => {
            setupFirestore({
                clinicData: mondayHours,
                appointments: Array.from({ length: 10 }, (_, index) => ({
                    id: `booked-${index}`,
                    data: { clinicId: "clinic-1", date: "2026-05-11", status: "booked", timeSlot: "09:00 - 10:00" }
                }))
            });

            await expect(
                queueService.addQueueItem("clinic-1", {
                    patientName: "Alice",
                    timeSlot: "09:00 - 10:00"
                })
            ).rejects.toThrow("This slot is full.");
        });

        it("rejects walk-ins when there are no available slots", async () => {
            setupFirestore({
                clinicData: {
                    operatingHours: {
                        monday: { open: "08:00", close: "08:00", isOpen: false }
                    }
                }
            });

            await expect(
                queueService.addQueueItem("clinic-1", { patientName: "Alice" })
            ).rejects.toThrow("The clinic is fully booked for today.");
        });
    });

    describe("consultation transitions", () => {
        it("prevents a staff member from starting a second active consultation", async () => {
            setupFirestore({
                queueItems: [
                    { id: "active", data: { assignedStaffId: "staff-1", status: "IN_CONSULTATION" } }
                ]
            });

            await expect(
                queueService.startConsultation("clinic-1", "waiting-1", "staff-1")
            ).rejects.toThrow("Staff member already has a patient IN_CONSULTATION");
        });

        it("starts a waiting consultation and enriches the patient details", async () => {
            const { queueRefs } = setupFirestore({
                queueItems: [
                    { id: "waiting-1", data: { status: "WAITING", patientId: "patient-1" } }
                ],
                patients: {
                    "patient-1": { fullName: "Patient One", email: "p1@example.com", phone: "123" }
                }
            });

            const result = await queueService.startConsultation("clinic-1", "waiting-1", "staff-1");

            expect(queueRefs["waiting-1"].update).toHaveBeenCalledWith(expect.objectContaining({
                status: "IN_CONSULTATION",
                assignedStaffId: "staff-1",
                consultationStartedAt: "mock-server-timestamp",
                updatedBy: "staff-1"
            }));
            expect(result).toEqual(expect.objectContaining({
                queueItemId: "waiting-1",
                status: "IN_CONSULTATION",
                patientName: "Patient One",
                patientEmail: "p1@example.com",
                patientPhone: "123"
            }));
        });

        it("requires the queue item to be waiting before starting", async () => {
            setupFirestore({
                queueItems: [
                    { id: "complete-1", data: { status: "COMPLETE", patientName: "Done" } }
                ]
            });

            await expect(
                queueService.startConsultation("clinic-1", "complete-1", "staff-1")
            ).rejects.toThrow("Patient is not in WAITING status");
        });

        it("completes a consultation and returns the highest priority next patient", async () => {
            const startTime = new Date("2026-05-11T07:35:00");
            const { queueRefs } = setupFirestore({
                queueItems: [
                    { id: "active", data: { status: "IN_CONSULTATION", patientName: "Active", consultationStartedAt: startTime } },
                    { id: "later", data: { status: "WAITING", patientName: "Later", priority: 2, appointmentTime: "08:00 - 09:00", queueNumber: 1 } },
                    { id: "next", data: { status: "WAITING", patientName: "Next", priority: 1, appointmentTime: "10:00 - 11:00", queueNumber: 5 } }
                ]
            });

            // Set fake timer system time to be exactly 15 minutes after start time
            jest.setSystemTime(new Date("2026-05-11T07:50:00"));

            const result = await queueService.completeConsultation("clinic-1", "active", "staff-1");

            expect(queueRefs.active.update).toHaveBeenCalledWith(expect.objectContaining({
                status: "COMPLETE",
                consultationCompletedAt: "mock-server-timestamp",
                actualDuration: 15,
                updatedBy: "staff-1"
            }));
            expect(result.completed).toEqual(expect.objectContaining({ queueItemId: "active", status: "COMPLETE", actualDuration: 15 }));
            expect(result.nextPatient).toEqual(expect.objectContaining({ queueItemId: "next" }));
        });

        it("requires an active consultation before completing", async () => {
            setupFirestore({
                queueItems: [
                    { id: "waiting-1", data: { status: "WAITING", patientName: "Waiting" } }
                ]
            });

            await expect(
                queueService.completeConsultation("clinic-1", "waiting-1", "staff-1")
            ).rejects.toThrow("Patient is not IN_CONSULTATION");
        });
    });

    describe("status, reschedule, and removal", () => {
        it("validates queue statuses", async () => {
            setupFirestore();

            await expect(
                queueService.updateQueueItemStatus("clinic-1", "queue-1", "UNKNOWN", "staff-1")
            ).rejects.toThrow("Invalid queue status");
        });

        it("does not update locked queue items", async () => {
            setupFirestore({
                queueItems: [
                    { id: "done", data: { status: "COMPLETE", patientName: "Done" } }
                ]
            });

            await expect(
                queueService.updateQueueItemStatus("clinic-1", "done", "WAITING", "staff-1")
            ).rejects.toThrow("Cannot update a missed or complete queue item");
        });

        it("updates a queue item status and enriches missing names", async () => {
            const { queueRefs } = setupFirestore({
                queueItems: [
                    { id: "queue-1", data: { status: "WAITING", patientId: "patient-1" } }
                ],
                patients: {
                    "patient-1": { patientName: "Fallback Name" }
                }
            });

            const result = await queueService.updateQueueItemStatus(
                "clinic-1",
                "queue-1",
                "MISSED",
                "staff-1"
            );

            expect(queueRefs["queue-1"].update).toHaveBeenCalledWith(expect.objectContaining({
                status: "MISSED",
                updatedBy: "staff-1"
            }));
            expect(result).toEqual(expect.objectContaining({
                status: "MISSED",
                patientName: "Fallback Name"
            }));
        });

        it("reschedules a queue item and syncs the linked appointment", async () => {
            const { appointmentRefs, queueRefs } = setupFirestore({
                clinicData: mondayHours,
                queueItems: [
                    { id: "queue-1", data: { status: "WAITING", patientName: "Alice", date: "2026-05-11", appointmentId: "appointment-1" } }
                ],
                appointments: [
                    { id: "appointment-1", data: { clinicId: "clinic-1", date: "2026-05-11", status: "booked", timeSlot: "08:00 - 09:00" } }
                ]
            });

            const result = await queueService.rescheduleQueueItem(
                "clinic-1",
                "queue-1",
                "10:00 - 11:00",
                "staff-1"
            );

            expect(queueRefs["queue-1"].update).toHaveBeenCalledWith(expect.objectContaining({
                timeSlot: "10:00 - 11:00",
                appointmentTime: "10:00 - 11:00"
            }));
            expect(appointmentRefs["appointment-1"].update).toHaveBeenCalledWith(expect.objectContaining({
                timeSlot: "10:00 - 11:00"
            }));
            expect(result).toEqual(expect.objectContaining({ timeSlot: "10:00 - 11:00" }));
        });

        it("does not reschedule locked queue items", async () => {
            setupFirestore({
                queueItems: [
                    { id: "missed", data: { status: "MISSED", patientName: "Missed" } }
                ]
            });

            await expect(
                queueService.rescheduleQueueItem("clinic-1", "missed", "10:00 - 11:00", "staff-1")
            ).rejects.toThrow("Cannot reschedule a missed or complete queue item");
        });

        it("removes queue items", async () => {
            const { queueRefs, queueItemMap } = setupFirestore({
                queueItems: [
                    { id: "queue-1", data: { status: "WAITING", patientName: "Alice" } }
                ]
            });

            const result = await queueService.removeQueueItem("clinic-1", "queue-1");

            expect(queueRefs["queue-1"].delete).toHaveBeenCalled();
            expect(queueItemMap.has("queue-1")).toBe(false);
            expect(result).toEqual(expect.objectContaining({ queueItemId: "queue-1", patientName: "Alice" }));
        });

        it("throws when removing a missing queue item", async () => {
            setupFirestore();

            await expect(
                queueService.removeQueueItem("clinic-1", "missing")
            ).rejects.toThrow("Queue item not found");
        });
    });

    describe("queue loading and appointment sync", () => {
        it("marks overdue waiting patients as missed and groups the queue", async () => {
            jest.setSystemTime(new Date("2026-05-11T09:00:00"));
            const { queueRefs } = setupFirestore({
                queueItems: [
                    { id: "old", data: { status: "WAITING", patientName: "Old", date: "2026-05-11", appointmentTime: "08:00 - 09:00", priority: 2, queueNumber: 1 } },
                    { id: "waiting", data: { status: "WAITING", patientId: "patient-1", date: "2026-05-11", appointmentTime: "09:00 - 10:00", priority: 1, queueNumber: 2 } },
                    { id: "active", data: { status: "IN_CONSULTATION", patientName: "Active" } },
                    { id: "other", data: { status: "UNKNOWN", patientName: "Ignored" } }
                ],
                patients: {
                    "patient-1": { email: "patient@example.com" }
                }
            });

            const queue = await queueService.getQueue("clinic-1");

            expect(queueRefs.old.update).toHaveBeenCalledWith(expect.objectContaining({
                status: "MISSED",
                updatedBy: "system"
            }));
            expect(queue.MISSED).toEqual([expect.objectContaining({ queueItemId: "old" })]);
            expect(queue.WAITING).toEqual([expect.objectContaining({
                queueItemId: "waiting",
                patientName: "patient@example.com"
            })]);
            expect(queue.IN_CONSULTATION).toEqual([expect.objectContaining({ queueItemId: "active" })]);
            expect(queue.COMPLETE).toEqual([]);
        });

        it("adds today's booked appointments to the queue and skips existing queue docs", async () => {
            jest.setSystemTime(new Date("2026-05-11T07:50:00"));
            const { queueRefs } = setupFirestore({
                appointments: [
                    { id: "existing", data: { clinicId: "clinic-1", clinicName: "Clinic", clinicAddress: "Road", date: "2026-05-11", status: "booked", patientId: "patient-existing", timeSlot: "08:00 - 09:00" } },
                    { id: "new", data: { clinicId: "clinic-1", clinicName: "Clinic", clinicAddress: "Road", date: "2026-05-11", status: "booked", patientId: "patient-new", timeSlot: "09:00 - 10:00", serviceId: "service-1", serviceName: "General Consultation", serviceDuration: 45 } }
                ],
                queueItems: [
                    { id: "existing", data: { status: "WAITING", patientName: "Already queued" } }
                ],
                patients: {
                    "patient-new": { name: "New Patient", email: "new@example.com", phone: "555" }
                }
            });

            const added = await queueService.addTodaysAppointmentsToQueue("clinic-1");

            expect(added).toHaveLength(1);
            expect(added[0]).toEqual(expect.objectContaining({
                queueItemId: "new",
                patientName: "New Patient",
                patientEmail: "new@example.com",
                patientPhone: "555",
                serviceId: "service-1",
                serviceName: "General Consultation",
                serviceDuration: 45
            }));
            expect(queueRefs.new.set).toHaveBeenCalledWith(expect.objectContaining({
                appointmentId: "new",
                status: "WAITING",
                appointmentTime: "09:00 - 10:00",
                serviceId: "service-1",
                serviceName: "General Consultation",
                serviceDuration: 45
            }));
            expect(queueRefs.existing.set).not.toHaveBeenCalled();
        });
    });

    describe("edge cases for branch coverage", () => {
        it("handles appointments with unrecognized timeSlots gracefully", async () => {
            setupFirestore({
                clinicData: mondayHours,
                appointments: [
                    { id: "weird-1", data: { clinicId: "clinic-1", date: "2026-05-11", status: "booked", timeSlot: "25:00 - 26:00" } }
                ]
            });
            const slots = await queueService.getAvailableQueueSlots("clinic-1", "2026-05-11");
            expect(slots).toBeDefined();
        });

        it("handles enrichQueueItemWithPatient when patient is missing or lacks fields", async () => {
            const { queueRefs } = setupFirestore({
                queueItems: [
                    { id: "wait-1", data: { status: "WAITING", patientId: "ghost", date: "2026-05-11", appointmentTime: "08:00 - 09:00", priority: 1, queueNumber: 1 } }
                ],
                patients: {} // ghost patient doesn't exist
            });
            const queue = await queueService.getQueue("clinic-1");
            expect(queue.WAITING[0].patientName).toBe("ghost"); // Falls back to ID
        });

        it("shouldMarkQueueItemMissed returns false for non-WAITING or invalid time items", async () => {
            jest.setSystemTime(new Date("2026-05-11T12:00:00"));
            const { queueRefs } = setupFirestore({
                queueItems: [
                    { id: "q1", data: { status: "COMPLETE", date: "2026-05-11", timeSlot: "08:00 - 09:00" } }, // Not WAITING
                    { id: "q2", data: { status: "WAITING", date: "2026-05-11", timeSlot: "invalid" } } // Invalid time match
                ]
            });
            const queue = await queueService.getQueue("clinic-1");
            // Should not be marked missed
            expect(queue.COMPLETE).toHaveLength(1); 
            expect(queue.WAITING).toHaveLength(1); // q2 stays waiting because time is invalid
        });

        it("normalizeToHourSlot returns null for completely invalid formats, treating it as a walk-in", async () => {
            setupFirestore({ clinicData: mondayHours });
            const result = await queueService.addQueueItem("clinic-1", {
                patientName: "Alice",
                timeSlot: "not-a-time"
            });
            expect(result.timeSlot).toBe("08:00 - 09:00");
        });
        
        it("gets missing patients via sync", async () => {
            setupFirestore({
                appointments: [
                    { id: "missing-patient", data: { clinicId: "clinic-1", date: "2026-05-11", status: "booked", timeSlot: "08:00 - 09:00" } }
                ]
            });
            await queueService.addTodaysAppointmentsToQueue("clinic-1");
        });
    });
});
