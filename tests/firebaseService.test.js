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
        it("should throw error if db fails during availability check", async () => {
            mockGet.mockRejectedValue(new Error("Avail Fail"));
            await expect(getAvailabilityForDate("c1", "d1")).rejects.toThrow("Avail Fail");
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

        it("gets clinic name by id", async () => {
            db.collection.mockReturnValue({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ clinicName: "Smart Clinic" }) })
                }))
            });

            await expect(getClinicNameById("clinic-1")).resolves.toBe("Smart Clinic");
        });
    });

    describe("clinic helpers", () => {
        it("validates an admin code", async () => {
            const query = createLoopQuery({ empty: false });
            db.collection.mockReturnValue(query);

            await expect(validateAdminCode("ADM-1", "clinic-1")).resolves.toBe(true);
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

        it("gets clinic id from staff code", async () => {
            const query = createLoopQuery({
                empty: false,
                docs: [{ id: "clinic-2" }]
            });
            db.collection.mockReturnValue(query);

            await expect(getStaffAssignmentFromCode("STF-1")).resolves.toBe("clinic-2");
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

<<<<<<< HEAD
    describe("createUserProfile", () => {
        it("should set claims and save to collection", async () => {
            mockSet.mockResolvedValue();
            await createUserProfile({ uid: "u1", role: "patient", fullName: "N", email: "e", phone: "p" });
            expect(mockSetCustomUserClaims).toHaveBeenCalledWith("u1", { role: "patient" });
            expect(mockSet).toHaveBeenCalled();
        });

        it("should throw on unsupported role", async () => {
            await expect(createUserProfile({ uid: "u1", role: "invalid" })).rejects.toThrow("Unsupported role");
        });
    });

    describe("getUserProfileById search loop", () => {
        it("should return null if found in no collections", async () => {
            mockGet.mockResolvedValue({ exists: false }); // Mocking all calls to return not found
            const res = await getUserProfileById("missing-uid");
            expect(res).toBeNull();
            expect(mockGet).toHaveBeenCalledTimes(4); // patients, admins, staff, users
        });
    });

    describe("createAppointment capacity", () => {
        it("should throw when at MAX_CAPACITY", async () => {
            mockGet.mockResolvedValueOnce({ empty: true }); // duplicate check
            mockGet.mockResolvedValueOnce({ size: 10 }); // Exactly at MAX_CAPACITY (10)
            await expect(createAppointment("c1", "d1", "t1", "p1")).rejects.toThrow("slot is full");
        });
    });

    describe("getUserProfileById search depth", () => {
        it("should find user in the last collection (users)", async () => {
            mockGet.mockResolvedValueOnce({ exists: false }); // patients
            mockGet.mockResolvedValueOnce({ exists: false }); // admins
            mockGet.mockResolvedValueOnce({ exists: false }); // staff
            mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ role: "user", uid: "u4" }) }); // users
            
            const res = await getUserProfileById("u4");
            expect(res.role).toBe("user");
            expect(mockGet).toHaveBeenCalledTimes(4);
        });
    });

    describe("cancelAppointment error flow", () => {
        it("should throw if booking not found", async () => {
            mockGet.mockResolvedValueOnce({ exists: false });
            await expect(cancelAppointment("fake-id")).rejects.toThrow("Booking not found");
        });
    });

    describe("getAppointmentsByPatientId success", () => {
        it("should return array of appointments", async () => {
            const mockDocs = [{ id: "a1", data: () => ({ date: "d1" }) }];
            mockGet.mockResolvedValueOnce({ forEach: (cb) => mockDocs.forEach(cb) });
            const res = await getAppointmentsByPatientId("p1");
            expect(res).toHaveLength(1);
            expect(res[0].id).toBe("a1");
        });
    });

    describe("getAppointmentsByPatientId error flow", () => {
        it("should throw on db error", async () => {
            mockGet.mockRejectedValue(new Error("DB Error"));
            await expect(getAppointmentsByPatientId("p1")).rejects.toThrow("DB Error");
        });
    });

    describe("getUserProfileByEmail exhaust search", () => {
        it("should return null if found in no collections", async () => {
            mockGet.mockResolvedValue({ empty: true });
            const res = await getUserProfileByEmail("unknown@unknown.com");
            expect(res).toBeNull();
            expect(mockGet).toHaveBeenCalledTimes(3); // patients, admins, staff
        });

        it("should return null on empty email", async () => {
            const res = await getUserProfileByEmail("");
            expect(res).toBeNull();
        });

        it("should find user in collections", async () => {
            mockGet.mockResolvedValueOnce({ empty: false, docs: [{ data: () => ({ email: "test@test.com" }) }] });
            const res = await getUserProfileByEmail("test@test.com");
            expect(res.email).toBe("test@test.com");
        });
    });

    describe("getClinicIdFromVerificationCode", () => {
        it("should find admin code in clinics", async () => {
            mockGet.mockResolvedValueOnce({ empty: false, docs: [{ id: "c1", data: () => ({ adminUid: "a1" }) }] });
            const res = await getClinicIdFromVerificationCode("ADMIN-CODE");
            expect(res.role).toBe("admin");
            expect(res.clinicId).toBe("c1");
        });

        it("should find staff code in clinics", async () => {
            mockGet.mockResolvedValueOnce({ empty: true }); // Admin check empty
            mockGet.mockResolvedValueOnce({ empty: false, docs: [{ id: "c1" }] }); // Staff check found
            const res = await getClinicIdFromVerificationCode("STAFF-CODE");
            expect(res.role).toBe("staff");
        });

        it("should return null if code not found", async () => {
            mockGet.mockResolvedValue({ empty: true });
            const res = await getClinicIdFromVerificationCode("FAKE");
            expect(res).toBeNull();
        });
    });

    describe("clinic management helpers", () => {
        it("validateAdminCode should return true if found", async () => {
            mockGet.mockResolvedValueOnce({ empty: false });
            const res = await validateAdminCode("C", "ID");
            expect(res).toBe(true);
        });

        it("getClinicNameById should return clinic name or default", async () => {
            mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ clinicName: "Health" }) });
            expect(await getClinicNameById("c1")).toBe("Health");
            
            mockGet.mockResolvedValueOnce({ exists: false });
            expect(await getClinicNameById("c2")).toBe("Unknown Clinic");
        });

        it("ensureClinicExists should return success", async () => {
            mockGet.mockResolvedValueOnce({ exists: true });
            const res = await ensureClinicExists({ clinicId: "c1" });
            expect(res.alreadyExists).toBe(true);

            mockGet.mockResolvedValueOnce({ exists: false });
            mockSet.mockResolvedValue();
            const res2 = await ensureClinicExists({ clinicId: "c2", name: "N", address: "A" });
            expect(res2.newlyCreated).toBe(true);
        });
    });

    describe("deleteUserAccount logic cleanup", () => {
        it("should clean up patient appointments", async () => {
            mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ role: "patient" }) });
            mockGet.mockResolvedValueOnce({ docs: [{ ref: { delete: mockDelete } }] }); // appointments
            await deleteUserAccount("u1");
            expect(mockDeleteUser).toHaveBeenCalled();
            expect(mockDelete).toHaveBeenCalled();
        });

        it("should handle service errors gracefully", async () => {
            mockGet.mockRejectedValue(new Error("Fail"));
            await expect(deleteUserAccount("u1")).rejects.toThrow("Fail");
=======
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
>>>>>>> clinic-search/Mzo
        });
    });
});
