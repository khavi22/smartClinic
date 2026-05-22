const mockServerTimestamp = jest.fn(() => "mock-server-timestamp");
const mockSetCustomUserClaims = jest.fn().mockResolvedValue();
const mockDeleteUser = jest.fn().mockResolvedValue();
const mockDb = {
    collection: jest.fn()
};
const mockFirestore = jest.fn(() => mockDb);
mockFirestore.FieldValue = {
    serverTimestamp: mockServerTimestamp
};

jest.mock("../services/config/firebase", () => ({
    db: mockDb,
    admin: {
        auth: jest.fn(() => ({
            setCustomUserClaims: mockSetCustomUserClaims,
            deleteUser: mockDeleteUser
        })),
        firestore: mockFirestore
    }
}));

const {
    getAvailabilityForDate,
    updateClinicOperatingHours,
    createAppointment,
    getAppointmentsByPatientId,
    getUserProfileById,
    createUserProfile,
    getUserProfileByEmail,
    cancelAppointment,
    validateAdminCode,
    createClinic,
    ensureClinicExists,
    getClinicIdFromAdminCode,
    getStaffAssignmentFromCode,
    getClinicIdFromVerificationCode,
    claimClinic,
    getClinicNameById,
    deleteUserAccount,
    getPatientProfileById,   // ✅ new
    getNoShowReport,
    getWaitTimeReport,
} = require("../services/firebaseService");
const { db } = require("../services/config/firebase");

function createLoopQuery(snapshot) {
    const query = {
        where: jest.fn(),
        get: jest.fn().mockResolvedValue(snapshot)
    };
    query.where.mockReturnValue(query);
    return query;
}

// Suite: groups related coverage for firebaseService.
describe("firebaseService", () => {
    // Setup: resets shared mocks and test data before each case in this scope.
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, "error").mockImplementation(() => {});
    });

    // Cleanup: restores mocks so one test cannot leak state into the next.
    afterEach(() => {
        console.error.mockRestore();
    });

    // Suite: groups related coverage for availability and appointments.
    describe("availability and appointments", () => {
        // Test: checks filters slots by clinic operating hours. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("filters slots by clinic operating hours", async () => {
            const clinicGet = jest.fn()
                .mockResolvedValueOnce({
                    exists: true,
                    data: () => ({
                        operatingHours: {
                            monday: { open: "09:00", close: "12:00", isOpen: true }
                        }
                    })
                });
            const appointmentsQuery = createLoopQuery({ empty: true, forEach: jest.fn() });

            db.collection.mockImplementation((name) => {
                if (name === "clinics") {
                    return { doc: jest.fn(() => ({ get: clinicGet })) };
                }
                if (name === "appointments") {
                    return appointmentsQuery;
                }
                return {};
            });

            const result = await getAvailabilityForDate("clinic-1", "2026-04-20");

            expect(result).toHaveLength(3);
            expect(result[0].time).toBe("09:00 - 10:00");
            expect(result[2].time).toBe("11:00 - 12:00");
        });

        // Test: checks returns empty availability when clinic is closed. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("returns empty availability when clinic is closed", async () => {
            const clinicGet = jest.fn().mockResolvedValue({
                exists: true,
                data: () => ({
                    operatingHours: {
                        sunday: { open: "00:00", close: "00:00", isOpen: false }
                    }
                })
            });

            db.collection.mockReturnValue({
                doc: jest.fn(() => ({ get: clinicGet }))
            });

            const result = await getAvailabilityForDate("clinic-1", "2026-04-19");
            expect(result).toEqual([]);
        });

        // Test: checks returns default availability when no clinic filter is applied. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("returns default availability when no clinic filter is applied", async () => {
            const appointmentsQuery = createLoopQuery({ empty: true, forEach: jest.fn() });

            db.collection.mockImplementation((name) => {
                if (name === "appointments") {
                    return appointmentsQuery;
                }
                return {};
            });

            const result = await getAvailabilityForDate("default", "2026-04-20");

            expect(result).toHaveLength(24);
            expect(appointmentsQuery.where).not.toHaveBeenCalledWith("clinicId", "==", "default");
        });

        // Test: checks updates clinic operating hours. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("updates clinic operating hours", async () => {
            const update = jest.fn().mockResolvedValue();
            db.collection.mockReturnValue({
                doc: jest.fn(() => ({ update }))
            });

            await updateClinicOperatingHours("clinic-1", { monday: { open: "10:00", close: "15:00", isOpen: true } });

            expect(update).toHaveBeenCalledWith({
                operatingHours: { monday: { open: "10:00", close: "15:00", isOpen: true } },
                updatedAt: "mock-server-timestamp"
            });
        });

        // Test: checks creates an appointment. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("creates an appointment", async () => {
        const duplicateQuery = createLoopQuery({ empty: true });
        const capacityQuery = createLoopQuery({ size: 0 });
        const add = jest.fn().mockResolvedValue({ id: "appt-1" });
        const appointmentsRef = {
            where: jest.fn()
                .mockImplementationOnce(() => duplicateQuery)
                .mockImplementationOnce(() => capacityQuery),
            add
        };

        db.collection.mockImplementation((name) => {
            if (name === "clinics") {
                return {
                    doc: jest.fn(() => ({
                        get: jest.fn().mockResolvedValue({
                            exists: true,
                            data: () => ({ slotCapacity: 10 })
                        })
                    }))
                };
            }
            return appointmentsRef;
        });

        const result = await createAppointment("clinic-1", "2026-04-20", "09:00 - 10:00", "patient-1", "Smart", "Addr");

        expect(result.id).toBe("appt-1");
        expect(add).toHaveBeenCalled();
    });

        // Test: checks returns appointments by patient id. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("returns appointments by patient id", async () => {
            const query = createLoopQuery({
                forEach: (callback) => {
                    callback({ id: "appt-1", data: () => ({ patientId: "patient-1" }) });
                }
            });
            db.collection.mockReturnValue(query);

            const result = await getAppointmentsByPatientId("patient-1");

            expect(result).toEqual([{ id: "appt-1", patientId: "patient-1" }]);
        });

        // Test: checks cancels an appointment. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("cancels an appointment", async () => {
            const update = jest.fn().mockResolvedValue();
            db.collection.mockReturnValue({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({ exists: true }),
                    update
                }))
            });

            await cancelAppointment("appt-1");

            expect(update).toHaveBeenCalledWith(expect.objectContaining({
                status: "cancelled"
            }));
        });

        // Test: checks marks a slot as limited and ignores unmatched appointments. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("marks a slot as limited and ignores unmatched appointments", async () => {
            const clinicGet = jest.fn().mockResolvedValue({ exists: false });
            const appointmentsQuery = createLoopQuery({
                empty: false,
                forEach: (callback) => {
                    callback({ data: () => ({ timeSlot: "09:00 - 10:00" }) });
                    callback({ data: () => ({ timeSlot: "09:00 - 10:00" }) });
                    callback({ data: () => ({ timeSlot: "09:00 - 10:00" }) });
                    callback({ data: () => ({ timeSlot: "09:00 - 10:00" }) });
                    callback({ data: () => ({ timeSlot: "09:00 - 10:00" }) });
                    callback({ data: () => ({ timeSlot: "09:00 - 10:00" }) });
                    callback({ data: () => ({ timeSlot: "09:00 - 10:00" }) });
                    callback({ data: () => ({ timeSlot: "not-a-real-slot" }) });
                }
            });

            db.collection.mockImplementation((name) => {
                if (name === "clinics") {
                    return { doc: jest.fn(() => ({ get: clinicGet })) };
                }
                if (name === "appointments") {
                    return appointmentsQuery;
                }
                return {};
            });

            const result = await getAvailabilityForDate("clinic-1", "2026-04-20");
            const slot = result.find((entry) => entry.time === "09:00 - 10:00");

            expect(slot.taken).toBe(7);
            expect(slot.status).toBe("limited");
        });

        // Test: checks throws when a duplicate appointment already exists. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("throws when a duplicate appointment already exists", async () => {
            const duplicateQuery = createLoopQuery({ empty: false });
            const appointmentsRef = {
                where: jest.fn().mockImplementationOnce(() => duplicateQuery),
                add: jest.fn()
            };

            db.collection.mockReturnValue(appointmentsRef);

            await expect(
                createAppointment("clinic-1", "2026-04-20", "09:00 - 10:00", "patient-1")
            ).rejects.toThrow("You already have a booking for this day.");
        });

        // Test: checks throws when the appointment slot is full. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("throws when the appointment slot is full", async () => {
            const duplicateQuery = createLoopQuery({ empty: true });
            const capacityQuery  = createLoopQuery({ size: 10 });
            const appointmentsRef = {
                where: jest.fn()
                    .mockImplementationOnce(() => duplicateQuery)
                    .mockImplementationOnce(() => capacityQuery),
                add: jest.fn()
            };

            db.collection.mockImplementation((name) => {
                if (name === "clinics") {
                    return {
                        doc: jest.fn(() => ({
                            get: jest.fn().mockResolvedValue({
                                exists: true,
                                data: () => ({ slotCapacity: 10 })
                            })
                        }))
                    };
                }
                return appointmentsRef;
            });

            await expect(
                createAppointment("clinic-1", "2026-04-20", "09:00 - 10:00", "patient-1")
            ).rejects.toThrow("This slot is full.");
        });

        // Test: checks uses clinic slot capacity when checking appointment fullness. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("uses clinic slot capacity when checking appointment fullness", async () => {
            const duplicateQuery = createLoopQuery({ empty: true });
            const capacityQuery = createLoopQuery({ size: 5 });
            const appointmentsRef = {
                where: jest.fn()
                    .mockImplementationOnce(() => duplicateQuery)
                    .mockImplementationOnce(() => capacityQuery),
                add: jest.fn()
            };

            db.collection.mockImplementation((name) => {
                if (name === "clinics") {
                    return {
                        doc: jest.fn(() => ({
                            get: jest.fn().mockResolvedValue({
                                exists: true,
                                data: () => ({ slotCapacity: 5 })
                            })
                        }))
                    };
                }
                return appointmentsRef;
            });

            await expect(
                createAppointment("clinic-1", "2026-04-20", "09:00 - 10:00", "patient-1")
            ).rejects.toThrow("This slot is full.");
        });

      // Test: checks creates a rescheduled appointment without duplicate check and uses defaults. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
      it("creates a rescheduled appointment without duplicate check and uses defaults", async () => {
        const capacityQuery = createLoopQuery({ size: 0 });
        const add = jest.fn().mockResolvedValue({ id: "appt-2" });
        const appointmentsRef = {
            where: jest.fn().mockImplementationOnce(() => capacityQuery),
            add
        };

        db.collection.mockImplementation((name) => {
            if (name === "clinics") {
                return {
                    doc: jest.fn(() => ({
                        get: jest.fn().mockResolvedValue({
                            exists: false
                        })
                    }))
                };
            }
            return appointmentsRef;
        });

        const result = await createAppointment(
            null,
            "2026-04-20",
            "10:00 - 11:00",
            "patient-1",
            null,
            null,
            true
        );

        expect(result).toEqual(expect.objectContaining({
            id: "appt-2",
            clinicId: "default",
            clinicName: "Unknown Clinic",
            clinicAddress: "N/A"
        }));
        expect(appointmentsRef.where).toHaveBeenCalledTimes(1);
    });

        // Test: checks should throw error if db fails during availability check. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("should throw error if db fails during availability check", async () => {
            const clinicGet = jest.fn().mockResolvedValue({ exists: false });
            const appointmentsQuery = createLoopQuery({ empty: true, forEach: jest.fn() });
            appointmentsQuery.get.mockRejectedValue(new Error("Avail Fail"));

            db.collection.mockImplementation((name) => {
                if (name === "clinics") {
                    return { doc: jest.fn(() => ({ get: clinicGet })) };
                }
                if (name === "appointments") {
                    return appointmentsQuery;
                }
                return {};
            });

            await expect(getAvailabilityForDate("c1", "d1")).rejects.toThrow("Avail Fail");
        });

        // Test: checks throws if getting appointments by patient id fails. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("throws if getting appointments by patient id fails", async () => {
            const query = createLoopQuery({ forEach: jest.fn() });
            query.get.mockRejectedValue(new Error("Patient lookup fail"));
            db.collection.mockReturnValue(query);

            await expect(getAppointmentsByPatientId("patient-1")).rejects.toThrow("Patient lookup fail");
        });
    });

    // ── getPatientProfileById ─────────────────────────────────────────────────
    // Suite: groups related coverage for getPatientProfileById.
    describe("getPatientProfileById", () => {
        // Test: checks returns patient data when patient exists. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("returns patient data when patient exists", async () => {
            db.collection.mockReturnValue({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({
                        exists: true,
                        data: () => ({
                            uid: "patient-1",
                            fullName: "Sipho Dlamini",
                            email: "sipho@gmail.com",
                            role: "patient"
                        })
                    })
                }))
            });

            const result = await getPatientProfileById("patient-1");

            expect(db.collection).toHaveBeenCalledWith("patients");
            expect(result).toEqual({
                uid: "patient-1",
                fullName: "Sipho Dlamini",
                email: "sipho@gmail.com",
                role: "patient"
            });
        });

        // Test: checks returns null when patient does not exist. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("returns null when patient does not exist", async () => {
            db.collection.mockReturnValue({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({ exists: false })
                }))
            });

            const result = await getPatientProfileById("nonexistent-id");

            expect(result).toBeNull();
        });
    });

    // Suite: groups related coverage for report helpers.
    describe("report helpers", () => {
        function appointmentSnapshot(appointments) {
            return {
                docs: appointments.map((appointment, index) => ({
                    id: `appointment-${index + 1}`,
                    data: () => appointment
                }))
            };
        }

        function mockAppointmentsQuery(appointments) {
            const query = {
                where: jest.fn(),
                get: jest.fn().mockResolvedValue(appointmentSnapshot(appointments))
            };
            query.where.mockReturnValue(query);
            db.collection.mockReturnValue(query);
            return query;
        }

        // Test: checks builds a no-show report with totals and daily breakdown. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("builds a no-show report with totals and daily breakdown", async () => {
            const query = mockAppointmentsQuery([
                { date: "2026-05-01", status: "booked" },
                { date: "2026-05-01", status: "missed" },
                { date: "2026-05-02", status: "cancelled" }
            ]);

            const result = await getNoShowReport("clinic-1", "2026-05-01", "2026-05-31");

            expect(query.where).toHaveBeenCalledWith("clinicId", "==", "clinic-1");
            expect(query.where).toHaveBeenCalledWith("date", ">=", "2026-05-01");
            expect(query.where).toHaveBeenCalledWith("date", "<=", "2026-05-31");
            expect(result).toEqual({
                clinicId: "clinic-1",
                startDate: "2026-05-01",
                endDate: "2026-05-31",
                totalScheduled: 3,
                totalNoShows: 2,
                noShowRate: "66.7%",
                breakdown: [
                    {
                        date: "2026-05-01",
                        total: 2,
                        noShows: 1,
                        noShowRate: "50.0%"
                    },
                    {
                        date: "2026-05-02",
                        total: 1,
                        noShows: 1,
                        noShowRate: "100.0%"
                    }
                ]
            });
        });

        // Test: checks builds an empty no-show report when there are no appointments. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("builds an empty no-show report when there are no appointments", async () => {
            mockAppointmentsQuery([]);

            await expect(
                getNoShowReport("clinic-1", "2026-05-01", "2026-05-31")
            ).resolves.toMatchObject({
                totalScheduled: 0,
                totalNoShows: 0,
                noShowRate: "0.0%",
                breakdown: []
            });
        });

        // Test: checks requires clinic and date range for no-show reports. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("requires clinic and date range for no-show reports", async () => {
            await expect(
                getNoShowReport("", "2026-05-01", "2026-05-31")
            ).rejects.toThrow("clinicId, startDate, and endDate are required");

            await expect(
                getNoShowReport("clinic-1", "", "2026-05-31")
            ).rejects.toThrow("clinicId, startDate, and endDate are required");

            await expect(
                getNoShowReport("clinic-1", "2026-05-01", "")
            ).rejects.toThrow("clinicId, startDate, and endDate are required");
        });

        // Test: checks builds wait-time report summaries by hour and date. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("builds wait-time report summaries by hour and date", async () => {
            const query = mockAppointmentsQuery([
                {
                    date: "2026-05-01",
                    status: "completed",
                    serviceDuration: 30,
                    timeSlot: "09:00"
                },
                {
                    date: "2026-05-01",
                    status: "completed",
                    serviceDuration: 45,
                    timeSlot: "09:30"
                },
                {
                    date: "2026-05-02",
                    status: "completed",
                    serviceDuration: 20
                },
                {
                    date: "2026-05-02",
                    status: "booked",
                    serviceDuration: 60,
                    timeSlot: "10:00"
                },
                {
                    date: "2026-05-02",
                    status: "completed",
                    serviceDuration: "30",
                    timeSlot: "11:00"
                },
                {
                    date: "2026-05-03",
                    status: "completed",
                    serviceDuration: 0,
                    timeSlot: "12:00"
                }
            ]);

            const result = await getWaitTimeReport("clinic-1", "2026-05-01", "2026-05-31");

            expect(query.where).toHaveBeenCalledWith("clinicId", "==", "clinic-1");
            expect(result).toEqual({
                clinicId: "clinic-1",
                startDate: "2026-05-01",
                endDate: "2026-05-31",
                totalCompleted: 3,
                overallAvgWaitMinutes: 31.7,
                byTimeOfDay: [
                    {
                        timeSlot: "09:00",
                        appointmentsCompleted: 2,
                        avgWaitMinutes: 37.5
                    },
                    {
                        timeSlot: "unknown:00",
                        appointmentsCompleted: 1,
                        avgWaitMinutes: 20
                    }
                ],
                byDate: [
                    {
                        date: "2026-05-01",
                        appointmentsCompleted: 2,
                        avgWaitMinutes: 37.5
                    },
                    {
                        date: "2026-05-02",
                        appointmentsCompleted: 1,
                        avgWaitMinutes: 20
                    }
                ]
            });
        });

        // Test: checks builds an empty wait-time report when no appointments completed. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("builds an empty wait-time report when no appointments completed", async () => {
            mockAppointmentsQuery([
                { date: "2026-05-01", status: "booked", serviceDuration: 30, timeSlot: "09:00" }
            ]);

            await expect(
                getWaitTimeReport("clinic-1", "2026-05-01", "2026-05-31")
            ).resolves.toMatchObject({
                totalCompleted: 0,
                overallAvgWaitMinutes: 0,
                byTimeOfDay: [],
                byDate: []
            });
        });

        // Test: checks requires clinic and date range for wait-time reports. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("requires clinic and date range for wait-time reports", async () => {
            await expect(
                getWaitTimeReport("", "2026-05-01", "2026-05-31")
            ).rejects.toThrow("clinicId, startDate, and endDate are required");

            await expect(
                getWaitTimeReport("clinic-1", "", "2026-05-31")
            ).rejects.toThrow("clinicId, startDate, and endDate are required");

            await expect(
                getWaitTimeReport("clinic-1", "2026-05-01", "")
            ).rejects.toThrow("clinicId, startDate, and endDate are required");
        });
    });

    // Suite: groups related coverage for profile helpers.
    describe("profile helpers", () => {
        // Test: checks creates a patient profile and custom claim. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("creates a patient profile and custom claim", async () => {
            const set = jest.fn().mockResolvedValue();
            db.collection.mockReturnValue({
                doc: jest.fn(() => ({ set }))
            });

            await createUserProfile({
                uid: "user-1",
                fullName: "John Doe",
                email: "john@example.com",
                role: "patient",
                phone: "1234567890"
            });

            expect(mockSetCustomUserClaims).toHaveBeenCalledWith("user-1", { role: "patient" });
            expect(db.collection).toHaveBeenCalledWith("patients");
            expect(set).toHaveBeenCalledWith(expect.objectContaining({
                uid: "user-1",
                role: "patient",
                createdAt: "mock-server-timestamp"
            }));
        });

        // Test: checks creates a staff profile. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("creates a staff profile", async () => {
            const set = jest.fn().mockResolvedValue();
            db.collection.mockReturnValue({
                doc: jest.fn(() => ({ set }))
            });

            await createUserProfile(
                {
                    uid: "staff-1",
                    fullName: "Jane Doe",
                    email: "jane@example.com",
                    role: "staff",
                    phone: "1234567890"
                },
                {
                    staffCode: "STF-123",
                    clinicId: "clinic-1"
                }
            );

            expect(db.collection).toHaveBeenCalledWith("staff");
            expect(set).toHaveBeenCalledWith(expect.objectContaining({
                uid: "staff-1",
                role: "staff",
                staffCode: "STF-123",
                clinicId: "clinic-1"
            }));
        });

        // Test: checks returns unsupported role error for unknown role. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("returns unsupported role error for unknown role", async () => {
            await expect(createUserProfile({
                uid: "u1",
                fullName: "Name",
                email: "e@example.com",
                role: "manager",
                phone: "123"
            })).rejects.toThrow("Unsupported role");
        });

        // Test: checks gets user profile by id across collections. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("gets user profile by id across collections", async () => {
            db.collection.mockImplementation((name) => ({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue(
                        name === "patients"
                            ? { exists: false }
                            : name === "admins"
                                ? { exists: true, data: () => ({ uid: "u1", role: "admin" }) }
                                : { exists: false }
                    )
                }))
            }));

            const result = await getUserProfileById("u1");
            expect(result).toEqual({ uid: "u1", role: "admin" });
        });

        // Test: checks returns null when no user profile exists by id. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("returns null when no user profile exists by id", async () => {
            db.collection.mockImplementation(() => ({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({ exists: false })
                }))
            }));

            await expect(getUserProfileById("missing")).resolves.toBeNull();
        });

        // Test: checks gets user profile by email across collections. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("gets user profile by email across collections", async () => {
            db.collection.mockImplementation((name) => ({
                where: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue(
                        name === "staff"
                            ? { empty: false, docs: [{ data: () => ({ uid: "u2", role: "staff" }) }] }
                            : { empty: true, docs: [] }
                    )
                }))
            }));

            const result = await getUserProfileByEmail("jane@example.com");
            expect(result).toEqual({ uid: "u2", role: "staff" });
        });

        // Test: checks returns null when email is empty. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("returns null when email is empty", async () => {
            await expect(getUserProfileByEmail("")).resolves.toBeNull();
        });

        // Test: checks returns null when no profile exists for email. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("returns null when no profile exists for email", async () => {
            db.collection.mockImplementation(() => ({
                where: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({ empty: true, docs: [] })
                }))
            }));

            await expect(getUserProfileByEmail("missing@example.com")).resolves.toBeNull();
        });

        // Test: checks gets clinic name by id. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("gets clinic name by id", async () => {
            db.collection.mockReturnValue({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ clinicName: "Smart Clinic" }) })
                }))
            });

            await expect(getClinicNameById("clinic-1")).resolves.toBe("Smart Clinic");
        });

        // Test: checks returns unknown clinic name when clinic is missing. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("returns unknown clinic name when clinic is missing", async () => {
            db.collection.mockReturnValue({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({ exists: false })
                }))
            });

            await expect(getClinicNameById("clinic-404")).resolves.toBe("Unknown Clinic");
        });
    });

    // Suite: groups related coverage for clinic helpers.
    describe("clinic helpers", () => {
        // Test: checks validates an admin code. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("validates an admin code", async () => {
            const query = createLoopQuery({ empty: false });
            db.collection.mockReturnValue(query);

            await expect(validateAdminCode("ADM-1", "clinic-1")).resolves.toBe(true);
        });

        // Test: checks returns false when admin code is invalid. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("returns false when admin code is invalid", async () => {
            const query = createLoopQuery({ empty: true });
            db.collection.mockReturnValue(query);

            await expect(validateAdminCode("ADM-BAD", "clinic-1")).resolves.toBe(false);
        });

        // Test: checks creates a clinic with admin code. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("creates a clinic with admin code", async () => {
            const set = jest.fn().mockResolvedValue();
            db.collection.mockReturnValue({
                doc: jest.fn(() => ({ set }))
            });

            const result = await createClinic({ placeId: "clinic-1", clinicName: "Smart Clinic", address: "Main Rd" });

            expect(result).toEqual({
                clinicId: "clinic-1",
                adminCode: expect.stringMatching(/^ADM-/)
            });
            expect(set).toHaveBeenCalled();
        });

        // Test: checks ensures a clinic exists without recreating it. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("ensures a clinic exists without recreating it", async () => {
            db.collection.mockReturnValue({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({ exists: true })
                }))
            });

            const result = await ensureClinicExists({ clinicId: "clinic-1", name: "Smart Clinic" });
            expect(result).toEqual({ success: true, alreadyExists: true });
        });

        // Test: checks creates a clinic when ensureClinicExists cannot find one. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("creates a clinic when ensureClinicExists cannot find one", async () => {
            const set = jest.fn().mockResolvedValue();
            db.collection.mockImplementation(() => ({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValueOnce({ exists: false }),
                    set
                }))
            }));

            const result = await ensureClinicExists({ clinicId: "clinic-2", name: "New Clinic", address: "Addr" });
            expect(result).toEqual({ success: true, newlyCreated: true });
        });

        // Test: checks gets clinic id from admin code. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("gets clinic id from admin code", async () => {
            const query = createLoopQuery({ empty: false, docs: [{ id: "clinic-1" }] });
            db.collection.mockReturnValue(query);

            await expect(getClinicIdFromAdminCode("ADM-1")).resolves.toBe("clinic-1");
        });

        // Test: checks returns null when admin code is not found. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("returns null when admin code is not found", async () => {
            const query = createLoopQuery({ empty: true, docs: [] });
            db.collection.mockReturnValue(query);

            await expect(getClinicIdFromAdminCode("ADM-MISSING")).resolves.toBeNull();
        });

        // Test: checks gets clinic id and role from admin verification code. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("gets clinic id and role from admin verification code", async () => {
            const adminQuery = createLoopQuery({ empty: false, docs: [{ id: "clinic-1" }] });
            const adminCollection = { where: jest.fn(() => adminQuery) };

            db.collection.mockReturnValue(adminCollection);
            adminQuery.where.mockReturnValue(adminQuery);

            await expect(getClinicIdFromVerificationCode("ADM-1")).resolves.toEqual({
                clinicId: "clinic-1",
                role: "admin"
            });
        });

        // Test: checks returns null when verification code does not match admin. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("returns null when verification code does not match admin", async () => {
            const adminQuery = createLoopQuery({ empty: true, docs: [] });
            const adminCollection = { where: jest.fn(() => adminQuery) };

            db.collection.mockReturnValue(adminCollection);
            adminQuery.where.mockReturnValue(adminQuery);

            await expect(getClinicIdFromVerificationCode("NONE")).resolves.toBeNull();
        });

        // Test: checks claims a clinic for an admin. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("claims a clinic for an admin", async () => {
            const update = jest.fn().mockResolvedValue();
            db.collection.mockReturnValue({
                doc: jest.fn(() => ({ update }))
            });

            await claimClinic("clinic-1", "admin-1");

            expect(update).toHaveBeenCalledWith({ adminUid: "admin-1", isActive: true });
        });
    });

    // Suite: groups related coverage for deleteUserAccount.
    describe("deleteUserAccount", () => {
        // Test: checks deletes a patient account and appointments. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("deletes a patient account and appointments", async () => {
            db.collection.mockImplementation((name) => {
                if (name === "patients") {
                    return {
                        doc: jest.fn(() => ({
                            get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ role: "patient" }) }),
                            delete: jest.fn().mockResolvedValue()
                        }))
                    };
                }
                if (name === "appointments") {
                    return {
                        where: jest.fn(() => ({
                            get: jest.fn().mockResolvedValue({
                                empty: false,
                                docs: [{ ref: { delete: jest.fn().mockResolvedValue() } }]
                            })
                        }))
                    };
                }
                return {
                    doc: jest.fn(() => ({
                        get: jest.fn().mockResolvedValue({ exists: false }),
                        delete: jest.fn().mockResolvedValue()
                    }))
                };
            });

            await deleteUserAccount("patient-1");
            expect(mockDeleteUser).toHaveBeenCalledWith("patient-1");
        });

        // Test: checks deletes an admin account and releases owned clinics. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("deletes an admin account and releases owned clinics", async () => {
            const clinicUpdate = jest.fn().mockResolvedValue();

            db.collection.mockImplementation((name) => {
                if (name === "patients") {
                    return {
                        doc: jest.fn(() => ({
                            get: jest.fn().mockResolvedValue({ exists: false }),
                            delete: jest.fn().mockResolvedValue()
                        }))
                    };
                }
                if (name === "admins") {
                    return {
                        doc: jest.fn(() => ({
                            get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ role: "admin" }) }),
                            delete: jest.fn().mockResolvedValue()
                        }))
                    };
                }
                if (name === "clinics") {
                    return {
                        where: jest.fn(() => ({
                            get: jest.fn().mockResolvedValue({
                                empty: false,
                                docs: [{ ref: { update: clinicUpdate } }]
                            })
                        }))
                    };
                }
                return {
                    doc: jest.fn(() => ({
                        get: jest.fn().mockResolvedValue({ exists: false }),
                        delete: jest.fn().mockResolvedValue()
                    }))
                };
            });

            await deleteUserAccount("admin-1");

            expect(clinicUpdate).toHaveBeenCalledWith({ adminUid: null, isActive: false });
            expect(mockDeleteUser).toHaveBeenCalledWith("admin-1");
        });

        // Test: checks deletes an unknown account without role-specific cleanup. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("deletes an unknown account without role-specific cleanup", async () => {
            db.collection.mockImplementation(() => ({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({ exists: false }),
                    delete: jest.fn().mockResolvedValue()
                }))
            }));

            await expect(deleteUserAccount("ghost-user")).resolves.toBeNull();
            expect(mockDeleteUser).toHaveBeenCalledWith("ghost-user");
        });
    });
});
