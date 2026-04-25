const mockServerTimestamp = jest.fn(() => "mock-server-timestamp");
const mockSetCustomUserClaims = jest.fn().mockResolvedValue();
const mockDeleteUser = jest.fn().mockResolvedValue();

jest.mock("../services/config/firebase", () => ({
    db: {
        collection: jest.fn()
    },
    admin: {
        auth: jest.fn(() => ({
            setCustomUserClaims: mockSetCustomUserClaims,
            deleteUser: mockDeleteUser
        })),
        firestore: {
            FieldValue: {
                serverTimestamp: mockServerTimestamp
            }
        }
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
    deleteUserAccount
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

describe("firebaseService", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        console.error.mockRestore();
    });

    describe("availability and appointments", () => {
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
            db.collection.mockReturnValue(appointmentsRef);

            const result = await createAppointment("clinic-1", "2026-04-20", "09:00 - 10:00", "patient-1", "Smart", "Addr");

            expect(result.id).toBe("appt-1");
            expect(add).toHaveBeenCalled();
        });

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

        it("throws when the appointment slot is full", async () => {
            const duplicateQuery = createLoopQuery({ empty: true });
            const capacityQuery = createLoopQuery({ size: 10 });
            const appointmentsRef = {
                where: jest.fn()
                    .mockImplementationOnce(() => duplicateQuery)
                    .mockImplementationOnce(() => capacityQuery),
                add: jest.fn()
            };

            db.collection.mockReturnValue(appointmentsRef);

            await expect(
                createAppointment("clinic-1", "2026-04-20", "09:00 - 10:00", "patient-1")
            ).rejects.toThrow("This slot is full.");
        });

        it("creates a rescheduled appointment without duplicate check and uses defaults", async () => {
            const capacityQuery = createLoopQuery({ size: 0 });
            const add = jest.fn().mockResolvedValue({ id: "appt-2" });
            const appointmentsRef = {
                where: jest.fn().mockImplementationOnce(() => capacityQuery),
                add
            };

            db.collection.mockReturnValue(appointmentsRef);

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

        it("throws if getting appointments by patient id fails", async () => {
            const query = createLoopQuery({ forEach: jest.fn() });
            query.get.mockRejectedValue(new Error("Patient lookup fail"));
            db.collection.mockReturnValue(query);

            await expect(getAppointmentsByPatientId("patient-1")).rejects.toThrow("Patient lookup fail");
        });
    });

    describe("profile helpers", () => {
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

        it("returns unsupported role error for unknown role", async () => {
            await expect(createUserProfile({
                uid: "u1",
                fullName: "Name",
                email: "e@example.com",
                role: "manager",
                phone: "123"
            })).rejects.toThrow("Unsupported role");
        });

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

        it("returns null when no user profile exists by id", async () => {
            db.collection.mockImplementation(() => ({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({ exists: false })
                }))
            }));

            await expect(getUserProfileById("missing")).resolves.toBeNull();
        });

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

        it("returns null when email is empty", async () => {
            await expect(getUserProfileByEmail("")).resolves.toBeNull();
        });

        it("returns null when no profile exists for email", async () => {
            db.collection.mockImplementation(() => ({
                where: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({ empty: true, docs: [] })
                }))
            }));

            await expect(getUserProfileByEmail("missing@example.com")).resolves.toBeNull();
        });

        it("gets clinic name by id", async () => {
            db.collection.mockReturnValue({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ clinicName: "Smart Clinic" }) })
                }))
            });

            await expect(getClinicNameById("clinic-1")).resolves.toBe("Smart Clinic");
        });

        it("returns unknown clinic name when clinic is missing", async () => {
            db.collection.mockReturnValue({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({ exists: false })
                }))
            });

            await expect(getClinicNameById("clinic-404")).resolves.toBe("Unknown Clinic");
        });
    });

    describe("clinic helpers", () => {
        it("validates an admin code", async () => {
            const query = createLoopQuery({ empty: false });
            db.collection.mockReturnValue(query);

            await expect(validateAdminCode("ADM-1", "clinic-1")).resolves.toBe(true);
        });

        it("returns false when admin code is invalid", async () => {
            const query = createLoopQuery({ empty: true });
            db.collection.mockReturnValue(query);

            await expect(validateAdminCode("ADM-BAD", "clinic-1")).resolves.toBe(false);
        });

        it("creates a clinic with admin and staff codes", async () => {
            const set = jest.fn().mockResolvedValue();
            db.collection.mockReturnValue({
                doc: jest.fn(() => ({ set }))
            });

            const result = await createClinic({ placeId: "clinic-1", clinicName: "Smart Clinic", address: "Main Rd" });

            expect(result).toEqual({
                clinicId: "clinic-1",
                adminCode: expect.stringMatching(/^ADM-/),
                staffCode: expect.stringMatching(/^STF-/)
            });
            expect(set).toHaveBeenCalled();
        });

        it("ensures a clinic exists without recreating it", async () => {
            db.collection.mockReturnValue({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({ exists: true })
                }))
            });

            const result = await ensureClinicExists({ clinicId: "clinic-1", name: "Smart Clinic" });
            expect(result).toEqual({ success: true, alreadyExists: true });
        });

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

        it("gets clinic id from admin code", async () => {
            const query = createLoopQuery({
                empty: false,
                docs: [{ id: "clinic-1" }]
            });
            db.collection.mockReturnValue(query);

            await expect(getClinicIdFromAdminCode("ADM-1")).resolves.toBe("clinic-1");
        });

        it("returns null when admin code is not found", async () => {
            const query = createLoopQuery({
                empty: true,
                docs: []
            });
            db.collection.mockReturnValue(query);

            await expect(getClinicIdFromAdminCode("ADM-MISSING")).resolves.toBeNull();
        });

        it("gets clinic id from staff code", async () => {
            const query = createLoopQuery({
                empty: false,
                docs: [{ id: "clinic-2" }]
            });
            db.collection.mockReturnValue(query);

            await expect(getStaffAssignmentFromCode("STF-1")).resolves.toBe("clinic-2");
        });

        it("returns null when staff code is not found", async () => {
            const query = createLoopQuery({
                empty: true,
                docs: []
            });
            db.collection.mockReturnValue(query);

            await expect(getStaffAssignmentFromCode("STF-MISSING")).resolves.toBeNull();
        });

        it("gets clinic id and role from admin verification code", async () => {
            const adminQuery = createLoopQuery({
                empty: false,
                docs: [{ id: "clinic-1" }]
            });
            const adminCollection = { where: jest.fn(() => adminQuery) };

            db.collection.mockImplementationOnce(() => adminCollection);
            adminQuery.where.mockReturnValue(adminQuery);

            await expect(getClinicIdFromVerificationCode("ADM-1")).resolves.toEqual({
                clinicId: "clinic-1",
                role: "admin"
            });
        });

        it("gets clinic id and role from generic verification code", async () => {
            const adminQuery = createLoopQuery({ empty: true, docs: [] });
            const staffQuery = createLoopQuery({
                empty: false,
                docs: [{ id: "clinic-2" }]
            });
            const adminCollection = { where: jest.fn(() => adminQuery) };
            const staffCollection = { where: jest.fn(() => staffQuery) };

            db.collection
                .mockImplementationOnce(() => adminCollection)
                .mockImplementationOnce(() => staffCollection);
            adminQuery.where.mockReturnValue(adminQuery);
            staffQuery.where.mockReturnValue(staffQuery);

            await expect(getClinicIdFromVerificationCode("STF-1")).resolves.toEqual({
                clinicId: "clinic-2",
                role: "staff"
            });

            expect(adminCollection.where).toHaveBeenCalledWith("adminCode", "==", "STF-1");
            expect(staffCollection.where).toHaveBeenCalledWith("staffCode", "==", "STF-1");
        });

        it("returns null when verification code matches neither admin nor staff", async () => {
            const adminQuery = createLoopQuery({ empty: true, docs: [] });
            const staffQuery = createLoopQuery({ empty: true, docs: [] });
            const adminCollection = { where: jest.fn(() => adminQuery) };
            const staffCollection = { where: jest.fn(() => staffQuery) };

            db.collection
                .mockImplementationOnce(() => adminCollection)
                .mockImplementationOnce(() => staffCollection);
            adminQuery.where.mockReturnValue(adminQuery);
            staffQuery.where.mockReturnValue(staffQuery);

            await expect(getClinicIdFromVerificationCode("NONE")).resolves.toBeNull();
        });

        it("claims a clinic for an admin", async () => {
            const update = jest.fn().mockResolvedValue();
            db.collection.mockReturnValue({
                doc: jest.fn(() => ({ update }))
            });

            await claimClinic("clinic-1", "admin-1");

            expect(update).toHaveBeenCalledWith({
                adminUid: "admin-1",
                isActive: true
            });
        });
    });

    describe("deleteUserAccount", () => {
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

            expect(clinicUpdate).toHaveBeenCalledWith({
                adminUid: null,
                isActive: false
            });
            expect(mockDeleteUser).toHaveBeenCalledWith("admin-1");
        });

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
