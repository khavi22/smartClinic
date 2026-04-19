const mockServerTimestamp = jest.fn(() => "SERVER_TIMESTAMP");
const mockDeleteUser = jest.fn();

jest.mock("../services/config/firebase", () => ({
    db: {
        collection: jest.fn()
    },
    admin: {
        firestore: {
            FieldValue: {
                serverTimestamp: mockServerTimestamp
            }
        },
        auth: () => ({
            deleteUser: mockDeleteUser
        })
    }
}));

const {
    getAvailabilityForDate,
    createAppointment,
    getAppointmentsByPatientId,
    createUserProfile,
    getClinicIdFromAdminCode,
    claimClinic,
    getUserProfileById,
    getUserProfileByEmail,
    cancelAppointment,
    validateAdminCode,
    createClinic,
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


beforeEach(() => {
    jest.clearAllMocks();
});

describe("getAvailabilityForDate", () => {
    it("should return the default slots when there are no bookings", async () => {
        const query = createLoopQuery({ empty: true });
        db.collection.mockReturnValue(query);

        const slots = await getAvailabilityForDate("default", "2026-04-19");

        expect(db.collection).toHaveBeenCalledWith("appointments");
        expect(query.where).toHaveBeenCalledWith("date", "==", "2026-04-19");
        expect(query.where).toHaveBeenCalledWith("status", "==", "booked");
        expect(slots).toHaveLength(24);
        expect(slots[0]).toEqual({
            id: 0,
            time: "00:00 - 01:00",
            total: 10,
            taken: 0,
            status: "available"
        });
    });

    it("should mark slots as limited and full for clinic-specific bookings", async () => {
        const query = createLoopQuery({
            empty: false,
            forEach: (callback) => {
                for (let i = 0; i < 7; i += 1) {
                    callback({
                        data: () => ({ timeSlot: "09:00 - 10:00" })
                    });
                }

                for (let i = 0; i < 10; i += 1) {
                    callback({
                        data: () => ({ timeSlot: "10:00 - 11:00" })
                    });
                }

                callback({
                    data: () => ({ timeSlot: "does-not-match" })
                });
            }
        });
        db.collection.mockReturnValue(query);

        const slots = await getAvailabilityForDate("clinic-123", "2026-04-19");

        expect(query.where).toHaveBeenCalledWith("clinicId", "==", "clinic-123");
        expect(slots.find((slot) => slot.time === "09:00 - 10:00")).toMatchObject({
            taken: 7,
            status: "limited"
        });
        expect(slots.find((slot) => slot.time === "10:00 - 11:00")).toMatchObject({
            taken: 10,
            status: "full"
        });
    });

    it("should throw when reading availability fails", async () => {
        const query = createLoopQuery({ empty: true });
        query.get.mockRejectedValue(new Error("Availability failed"));
        db.collection.mockReturnValue(query);

        await expect(getAvailabilityForDate("default", "2026-04-19")).rejects.toThrow("Availability failed");
    });
});

describe("createAppointment", () => {
    it("should create an appointment for a clinic when checks pass", async () => {
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

        const result = await createAppointment(
            "clinic-123",
            "2026-04-20",
            "09:00 - 10:00",
            "patient-1",
            "Smart Clinic",
            "123 Main Rd"
        );

        expect(capacityQuery.where).toHaveBeenCalledWith("clinicId", "==", "clinic-123");
        expect(add).toHaveBeenCalledWith({
            clinicId: "clinic-123",
            clinicName: "Smart Clinic",
            clinicAddress: "123 Main Rd",
            date: "2026-04-20",
            timeSlot: "09:00 - 10:00",
            patientId: "patient-1",
            status: "booked",
            createdAt: expect.any(String)
        });
        expect(result).toMatchObject({
            id: "appt-1",
            clinicId: "clinic-123",
            clinicName: "Smart Clinic",
            clinicAddress: "123 Main Rd",
            patientId: "patient-1"
        });
    });

    it("should skip duplicate checks when rescheduling and use default clinic values", async () => {
        const capacityQuery = createLoopQuery({ size: 0 });
        const add = jest.fn().mockResolvedValue({ id: "appt-2" });
        const appointmentsRef = {
            where: jest.fn().mockImplementationOnce(() => capacityQuery),
            add
        };

        db.collection.mockReturnValue(appointmentsRef);

        const result = await createAppointment(
            "",
            "2026-04-20",
            "11:00 - 12:00",
            "patient-1",
            undefined,
            undefined,
            true
        );

        expect(appointmentsRef.where).toHaveBeenCalledTimes(1);
        expect(add).toHaveBeenCalledWith({
            clinicId: "default",
            clinicName: "Unknown Clinic",
            clinicAddress: "N/A",
            date: "2026-04-20",
            timeSlot: "11:00 - 12:00",
            patientId: "patient-1",
            status: "booked",
            createdAt: expect.any(String)
        });
        expect(result.id).toBe("appt-2");
    });

    it("should throw when the patient already has a booking for the day", async () => {
        const duplicateQuery = createLoopQuery({ empty: false });
        const appointmentsRef = {
            where: jest.fn().mockImplementationOnce(() => duplicateQuery),
            add: jest.fn()
        };

        db.collection.mockReturnValue(appointmentsRef);

        await expect(
            createAppointment("clinic-123", "2026-04-20", "09:00 - 10:00", "patient-1")
        ).rejects.toThrow("You already have a booking for this day.");
    });

    it("should throw when the slot is full", async () => {
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
            createAppointment("clinic-123", "2026-04-20", "09:00 - 10:00", "patient-1")
        ).rejects.toThrow("This slot is full.");
    });
});

describe("getAppointmentsByPatientId", () => {
    it("should return appointments for a patientId", async () => {
        const query = createLoopQuery({
            forEach: (callback) => {
                callback({
                    id: "appt1",
                    data: () => ({
                        patientId: "patient123",
                        status: "booked"
                    })
                });

                callback({
                    id: "appt2",
                    data: () => ({
                        patientId: "patient123",
                        status: "pending"
                    })
                });
            }
        });

        db.collection.mockReturnValue(query);

        const result = await getAppointmentsByPatientId("patient123");

        expect(db.collection).toHaveBeenCalledWith("appointments");
        expect(query.where).toHaveBeenCalledWith("patientId", "==", "patient123");
        expect(result).toEqual([
            { id: "appt1", patientId: "patient123", status: "booked" },
            { id: "appt2", patientId: "patient123", status: "pending" }
        ]);
    });

    it("should return an empty array if no appointments are found", async () => {
        const query = createLoopQuery({ forEach: jest.fn() });
        db.collection.mockReturnValue(query);

        const result = await getAppointmentsByPatientId("patient999");

        expect(result).toEqual([]);
    });

    it("should throw if the database read fails", async () => {
        const query = createLoopQuery({ forEach: jest.fn() });
        query.get.mockRejectedValue(new Error("DB error"));
        db.collection.mockReturnValue(query);

        await expect(getAppointmentsByPatientId("patient123")).rejects.toThrow("DB error");
    });
});

describe("profile helpers", () => {
    it("should return an admin by id after checking patients", async () => {
        const patientGet = jest.fn().mockResolvedValue({ exists: false });
        const adminGet = jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ uid: "user-1", role: "admin" })
        });

        db.collection.mockImplementation((name) => ({
            doc: jest.fn(() => ({
                get: name === "patients" ? patientGet : adminGet
            }))
        }));

        const result = await getUserProfileById("user-1");

        expect(result).toEqual({ uid: "user-1", role: "admin" });
    });

    it("should return a patient by id immediately when found", async () => {
        const patientGet = jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ uid: "user-1", role: "patient" })
        });
        const adminGet = jest.fn();

        db.collection.mockImplementation((name) => ({
            doc: jest.fn(() => ({
                get: name === "patients" ? patientGet : adminGet
            }))
        }));

        const result = await getUserProfileById("user-1");

        expect(result).toEqual({ uid: "user-1", role: "patient" });
        expect(adminGet).not.toHaveBeenCalled();
    });

    it("should return null when no profile exists by id", async () => {
        const get = jest.fn().mockResolvedValue({ exists: false });
        db.collection.mockImplementation(() => ({
            doc: jest.fn(() => ({ get }))
        }));

        const result = await getUserProfileById("missing-user");

        expect(result).toBeNull();
    });

    it("should create a role-based profile with a timestamp", async () => {
        const set = jest.fn().mockResolvedValue();
        db.collection.mockReturnValue({
            doc: jest.fn(() => ({ set }))
        });

        await createUserProfile(
            {
                uid: "test-uid",
                fullName: "John Doe",
                email: "john@example.com",
                phone: "1234567890",
                role: "admin"
            },
            {
                adminCode: "ADM-A1B2C3",
                clinicId: "clinic-123"
            }
        );

        expect(db.collection).toHaveBeenCalledWith("admins");
        expect(set).toHaveBeenCalledWith({
            uid: "test-uid",
            fullName: "John Doe",
            email: "john@example.com",
            phone: "1234567890",
            role: "admin",
            adminCode: "ADM-A1B2C3",
            clinicId: "clinic-123",
            createdAt: "SERVER_TIMESTAMP"
        });
    });

    it("should throw for an unsupported role", async () => {
        await expect(
            createUserProfile({
                uid: "test-uid",
                fullName: "John Doe",
                email: "john@example.com",
                phone: "1234567890",
                role: "staff"
            })
        ).rejects.toThrow("Unsupported role");
    });

    it("should return null when email is empty", async () => {
        await expect(getUserProfileByEmail("")).resolves.toBeNull();
    });

    it("should return an admin by email after checking patients first", async () => {
        const patientQuery = createLoopQuery({ empty: true, docs: [] });
        const adminQuery = createLoopQuery({
            empty: false,
            docs: [{ data: () => ({ uid: "user-1", email: "john@example.com", role: "admin" }) }]
        });

        db.collection.mockImplementation((name) => ({
            where: name === "patients" ? patientQuery.where : adminQuery.where
        }));
        patientQuery.where.mockReturnValue(patientQuery);
        adminQuery.where.mockReturnValue(adminQuery);

        const result = await getUserProfileByEmail("john@example.com");

        expect(result).toEqual({ uid: "user-1", email: "john@example.com", role: "admin" });
    });

    it("should return a patient by email without checking admins", async () => {
        const patientQuery = createLoopQuery({
            empty: false,
            docs: [{ data: () => ({ uid: "patient-1", email: "john@example.com", role: "patient" }) }]
        });
        const adminWhere = jest.fn();

        db.collection.mockImplementation((name) => ({
            where: name === "patients" ? patientQuery.where : adminWhere
        }));
        patientQuery.where.mockReturnValue(patientQuery);

        const result = await getUserProfileByEmail("john@example.com");

        expect(result).toEqual({ uid: "patient-1", email: "john@example.com", role: "patient" });
        expect(adminWhere).not.toHaveBeenCalled();
    });

    it("should return null when no email match exists", async () => {
        const patientQuery = createLoopQuery({ empty: true, docs: [] });
        const adminQuery = createLoopQuery({ empty: true, docs: [] });

        db.collection.mockImplementation((name) => ({
            where: name === "patients" ? patientQuery.where : adminQuery.where
        }));
        patientQuery.where.mockReturnValue(patientQuery);
        adminQuery.where.mockReturnValue(adminQuery);

        const result = await getUserProfileByEmail("missing@example.com");

        expect(result).toBeNull();
    });
});

describe("appointment mutation helpers", () => {
    it("should cancel an appointment successfully", async () => {
        const update = jest.fn().mockResolvedValue();
        db.collection.mockReturnValue({
            doc: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({ exists: true }),
                update
            }))
        });

        const result = await cancelAppointment("appt-1");

        expect(result).toEqual({
            success: true,
            message: "Booking cancelled successfully"
        });
        expect(update).toHaveBeenCalledWith({
            status: "cancelled",
            updatedAt: expect.any(Date)
        });
    });

    it("should throw when cancelling a missing appointment", async () => {
        db.collection.mockReturnValue({
            doc: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({ exists: false }),
                update: jest.fn()
            }))
        });

        await expect(cancelAppointment("appt-1")).rejects.toThrow("Booking not found");
    });
});

describe("clinic helpers", () => {
    it("should validate an admin code", async () => {
        const query = createLoopQuery({ empty: false });
        db.collection.mockReturnValue(query);

        await expect(validateAdminCode("ADM-123", "clinic-1")).resolves.toBe(true);
        expect(query.where).toHaveBeenCalledWith("code", "==", "ADM-123");
        expect(query.where).toHaveBeenCalledWith("clinicId", "==", "clinic-1");
        expect(query.where).toHaveBeenCalledWith("used", "==", false);
    });

    it("should return false for an invalid admin code", async () => {
        const query = createLoopQuery({ empty: true });
        db.collection.mockReturnValue(query);

        await expect(validateAdminCode("ADM-123", "clinic-1")).resolves.toBe(false);
    });

    it("should create a clinic with an admin code", async () => {
        const set = jest.fn().mockResolvedValue();
        db.collection.mockReturnValue({
            doc: jest.fn(() => ({ set }))
        });

        const result = await createClinic({
            placeId: "place-1",
            clinicName: "Smart Clinic",
            city: "Cape Town"
        });

        expect(result).toEqual({
            clinicId: "place-1",
            adminCode: expect.stringMatching(/^ADM-/)
        });
        expect(set).toHaveBeenCalledWith(expect.objectContaining({
            placeId: "place-1",
            clinicName: "Smart Clinic",
            city: "Cape Town",
            adminCode: result.adminCode,
            adminUid: null,
            isActive: false,
            createdAt: "SERVER_TIMESTAMP"
        }));
    });

    it("should return clinicId when the admin code is valid and unused", async () => {
        const query = createLoopQuery({
            empty: false,
            docs: [{ id: "clinic-123" }]
        });
        db.collection.mockReturnValue(query);

        const result = await getClinicIdFromAdminCode("ADM-A1B2C3");

        expect(result).toBe("clinic-123");
        expect(query.where).toHaveBeenCalledWith("adminCode", "==", "ADM-A1B2C3");
        expect(query.where).toHaveBeenCalledWith("adminUid", "==", null);
        expect(query.where).toHaveBeenCalledWith("isActive", "==", false);
    });

    it("should return null when the admin code is invalid", async () => {
        const query = createLoopQuery({
            empty: true,
            docs: []
        });
        db.collection.mockReturnValue(query);

        const result = await getClinicIdFromAdminCode("ADM-INVALID");

        expect(result).toBeNull();
    });

    it("should update a clinic with admin ownership", async () => {
        const update = jest.fn().mockResolvedValue();
        db.collection.mockReturnValue({
            doc: jest.fn(() => ({ update }))
        });

        await claimClinic("clinic-123", "test-uid");

        expect(update).toHaveBeenCalledWith({
            adminUid: "test-uid",
            isActive: true
        });
    });
});

describe("deleteUserAccount", () => {
    it("should delete a patient account and any patient appointments", async () => {
        const patientGet = jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ uid: "patient-1", role: "patient" })
        });
        const adminGet = jest.fn();
        const patientDelete = jest.fn().mockResolvedValue();
        const adminDelete = jest.fn().mockResolvedValue();
        const appointmentDelete = jest.fn().mockResolvedValue();
        const appointmentsQuery = createLoopQuery({
            empty: false,
            docs: [{ ref: { delete: appointmentDelete } }]
        });

        db.collection.mockImplementation((name) => {
            if (name === "patients") {
                return {
                    doc: jest.fn(() => ({
                        get: patientGet,
                        delete: patientDelete
                    }))
                };
            }

            if (name === "admins") {
                return {
                    doc: jest.fn(() => ({
                        get: adminGet,
                        delete: adminDelete
                    }))
                };
            }

            if (name === "appointments") {
                return {
                    where: appointmentsQuery.where
                };
            }

            return {};
        });
        appointmentsQuery.where.mockReturnValue(appointmentsQuery);

        const profile = await deleteUserAccount("patient-1");

        expect(profile).toEqual({ uid: "patient-1", role: "patient" });
        expect(appointmentDelete).toHaveBeenCalled();
        expect(patientDelete).toHaveBeenCalled();
        expect(adminDelete).toHaveBeenCalled();
        expect(mockDeleteUser).toHaveBeenCalledWith("patient-1");
    });

    it("should clean up an admin account even when there are no clinics or appointments", async () => {
        const patientGet = jest.fn().mockResolvedValue({ exists: false });
        const adminGet = jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ uid: "admin-1", role: "admin" })
        });
        const patientDelete = jest.fn().mockResolvedValue();
        const adminDelete = jest.fn().mockResolvedValue();
        const clinicsQuery = createLoopQuery({ empty: true, docs: [] });
        const appointmentsQuery = createLoopQuery({ empty: true, docs: [] });

        db.collection.mockImplementation((name) => {
            if (name === "patients") {
                return {
                    doc: jest.fn(() => ({
                        get: patientGet,
                        delete: patientDelete
                    }))
                };
            }

            if (name === "admins") {
                return {
                    doc: jest.fn(() => ({
                        get: adminGet,
                        delete: adminDelete
                    }))
                };
            }

            if (name === "clinics") {
                return { where: clinicsQuery.where };
            }

            if (name === "appointments") {
                return { where: appointmentsQuery.where };
            }

            return {};
        });
        clinicsQuery.where.mockReturnValue(clinicsQuery);
        appointmentsQuery.where.mockReturnValue(appointmentsQuery);

        const profile = await deleteUserAccount("admin-1");

        expect(profile).toEqual({ uid: "admin-1", role: "admin" });
        expect(clinicsQuery.where).toHaveBeenCalledWith("adminUid", "==", "admin-1");
        expect(appointmentsQuery.where).toHaveBeenCalledWith("patientId", "==", "admin-1");
        expect(patientDelete).toHaveBeenCalled();
        expect(adminDelete).toHaveBeenCalled();
        expect(mockDeleteUser).toHaveBeenCalledWith("admin-1");
    });

    it("should release clinics owned by an admin during account deletion", async () => {
        const patientGet = jest.fn().mockResolvedValue({ exists: false });
        const adminGet = jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ uid: "admin-2", role: "admin" })
        });
        const patientDelete = jest.fn().mockResolvedValue();
        const adminDelete = jest.fn().mockResolvedValue();
        const clinicUpdate = jest.fn().mockResolvedValue();
        const clinicsQuery = createLoopQuery({
            empty: false,
            docs: [{ ref: { update: clinicUpdate } }]
        });
        const appointmentsQuery = createLoopQuery({ empty: true, docs: [] });

        db.collection.mockImplementation((name) => {
            if (name === "patients") {
                return {
                    doc: jest.fn(() => ({
                        get: patientGet,
                        delete: patientDelete
                    }))
                };
            }

            if (name === "admins") {
                return {
                    doc: jest.fn(() => ({
                        get: adminGet,
                        delete: adminDelete
                    }))
                };
            }

            if (name === "clinics") {
                return { where: clinicsQuery.where };
            }

            if (name === "appointments") {
                return { where: appointmentsQuery.where };
            }

            return {};
        });
        clinicsQuery.where.mockReturnValue(clinicsQuery);
        appointmentsQuery.where.mockReturnValue(appointmentsQuery);

        await deleteUserAccount("admin-2");

        expect(clinicUpdate).toHaveBeenCalledWith({
            adminUid: null,
            isActive: false
        });
        expect(mockDeleteUser).toHaveBeenCalledWith("admin-2");
    });
});
