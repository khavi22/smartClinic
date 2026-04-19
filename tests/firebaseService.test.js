const { 
    getAppointmentsByPatientId, 
    getAvailabilityForDate, 
    createAppointment, 
    cancelAppointment, 
    getUserProfileById, 
    createUserProfile,
    getClinicIdFromVerificationCode,
    claimClinic,
    ensureClinicExists,
    updateClinicOperatingHours,
    deleteUserAccount,
    getUserProfileByEmail,
    getClinicNameById,
    createClinic,
    validateAdminCode
} = require("../services/firebaseService");
const { db, admin } = require("../services/config/firebase");

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
            serverTimestamp: jest.fn().mockReturnValue("mock-server-timestamp")
        }
    }
  }
}));

<<<<<<< HEAD
const {
    getAvailabilityForDate,
    createAppointment,
    getAppointmentsByPatientId,
    createUserProfile,
    getClinicIdFromAdminCode,
    getStaffAssignmentFromCode,
    claimClinic,
    getUserProfileById,
    getUserProfileByEmail,
    cancelAppointment,
    validateAdminCode,
    createClinic,
    deleteUserAccount
} = require("../services/firebaseService");
const { db } = require("../services/config/firebase");
=======
describe("firebaseService Tests", () => {
    let mockGet, mockWhere, mockSet, mockUpdate, mockDoc, mockAdd, mockDelete;
>>>>>>> 8990dce747880d8a601e65dc9606fbe4e9a7b29b

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, "error").mockImplementation(() => {});

        mockGet = jest.fn();
        mockSet = jest.fn();
        mockUpdate = jest.fn();
        mockWhere = jest.fn();
        mockAdd = jest.fn();
        mockDelete = jest.fn();
        mockDoc = jest.fn(() => ({ 
            set: mockSet, 
            get: mockGet, 
            update: mockUpdate, 
            delete: mockDelete,
            ref: { update: mockUpdate, delete: mockDelete }
        }));
        
        const queryRef = {
            where: mockWhere,
            get: mockGet,
            doc: mockDoc,
            add: mockAdd
        };
        mockWhere.mockReturnValue(queryRef);
        db.collection.mockReturnValue(queryRef);
    });

    describe("getAvailabilityForDate", () => {
        it("should handle full and limited statuses", async () => {
            mockGet.mockResolvedValueOnce({ exists: false });
            const mockDocs = Array(10).fill({ data: () => ({ timeSlot: "08:00 - 09:00" }) });
            mockGet.mockResolvedValueOnce({ empty: false, forEach: (cb) => mockDocs.forEach(cb) });
            const res = await getAvailabilityForDate("c1", "d1");
            expect(res.find(s => s.time === "08:00 - 09:00").status).toBe("full");
        });
    });

    describe("createAppointment", () => {
        it("should throw if duplicate found (isReschedule=false)", async () => {
            mockGet.mockResolvedValueOnce({ empty: false }); // duplicate check
            await expect(createAppointment("c1", "d1", "t1", "p1")).rejects.toThrow("booking for this day");
        });

<<<<<<< HEAD
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
        const staffGet = jest.fn();

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
        const staffGet = jest.fn();

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
                role: "manager"
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
        const staffQuery = createLoopQuery({ empty: true, docs: [] });

        db.collection.mockImplementation((name) => ({
            where:
                name === "patients"
                    ? patientQuery.where
                    : name === "admins"
                        ? adminQuery.where
                        : staffQuery.where
        }));
        patientQuery.where.mockReturnValue(patientQuery);
        adminQuery.where.mockReturnValue(adminQuery);
        staffQuery.where.mockReturnValue(staffQuery);

        const result = await getUserProfileByEmail("missing@example.com");

        expect(result).toBeNull();
    });

    it("should create a staff profile in the staff collection", async () => {
        const set = jest.fn().mockResolvedValue();
        db.collection.mockReturnValue({
            doc: jest.fn(() => ({ set }))
        });

        await createUserProfile(
            {
                uid: "staff-1",
                fullName: "Jane Doe",
                email: "jane@example.com",
                phone: "1234567890",
                role: "staff"
            },
            {
                staffCode: "STF-A1B2C3",
                clinicId: "clinic-456"
            }
        );

        expect(db.collection).toHaveBeenCalledWith("staff");
        expect(set).toHaveBeenCalledWith({
            uid: "staff-1",
            fullName: "Jane Doe",
            email: "jane@example.com",
            phone: "1234567890",
            role: "staff",
            staffCode: "STF-A1B2C3",
            clinicId: "clinic-456",
            createdAt: "SERVER_TIMESTAMP"
        });
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
=======
        it("should create successfully when not rescheduling", async () => {
            mockGet.mockResolvedValueOnce({ empty: true }); // duplicate
            mockGet.mockResolvedValueOnce({ size: 0 }); // capacity
            mockAdd.mockResolvedValue({ id: "a1" });
            const res = await createAppointment("c1", "d1", "t1", "p1", "C", "A");
            expect(res.id).toBe("a1");
        });
    });

    describe("getUserProfileById", () => {
        it("should return profile if found in first collection", async () => {
            mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ role: "patient", uid: "u1" }) });
            const res = await getUserProfileById("u1");
            expect(res.role).toBe("patient");
>>>>>>> 8990dce747880d8a601e65dc9606fbe4e9a7b29b
        });
    });

    describe("cancelAppointment", () => {
        it("should update status and updatedAt", async () => {
            mockGet.mockResolvedValueOnce({ exists: true, data: () => ({}) });
            await cancelAppointment("a1");
            expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "cancelled" }));
        });
    });

<<<<<<< HEAD
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
=======
    describe("deleteUserAccount", () => {
        it("should handle roles and cleanup", async () => {
            mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ role: "admin" }) });
            mockGet.mockResolvedValueOnce({ docs: [{ ref: { update: mockUpdate } }] });
            await deleteUserAccount("u1");
            expect(mockUpdate).toHaveBeenCalled();
>>>>>>> 8990dce747880d8a601e65dc9606fbe4e9a7b29b
        });
    });

    it("should return the clinic id for a valid staff code", async () => {
        const query = createLoopQuery({
            empty: false,
            docs: [{ id: "clinic-456" }]
        });
        db.collection.mockReturnValue(query);

        const result = await getStaffAssignmentFromCode("STF-A1B2C3");

        expect(result).toBe("clinic-456");
        expect(query.where).toHaveBeenCalledWith("staffCode", "==", "STF-A1B2C3");
    });

    it("should return null for an invalid staff code", async () => {
        const query = createLoopQuery({
            empty: true,
            docs: []
        });
        db.collection.mockReturnValue(query);

        const result = await getStaffAssignmentFromCode("STF-INVALID");

        expect(result).toBeNull();
    });
});
<<<<<<< HEAD

describe("deleteUserAccount", () => {
    it("should delete a patient account and any patient appointments", async () => {
        const patientGet = jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ uid: "patient-1", role: "patient" })
        });
        const adminGet = jest.fn();
        const staffGet = jest.fn().mockResolvedValue({ exists: false });
        const patientDelete = jest.fn().mockResolvedValue();
        const adminDelete = jest.fn().mockResolvedValue();
        const staffDelete = jest.fn().mockResolvedValue();
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

            if (name === "staff") {
                return {
                    doc: jest.fn(() => ({
                        get: staffGet,
                        delete: staffDelete
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
        expect(staffDelete).toHaveBeenCalled();
        expect(mockDeleteUser).toHaveBeenCalledWith("patient-1");
    });

    it("should clean up an admin account even when there are no clinics or appointments", async () => {
        const patientGet = jest.fn().mockResolvedValue({ exists: false });
        const adminGet = jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ uid: "admin-1", role: "admin" })
        });
        const staffGet = jest.fn().mockResolvedValue({ exists: false });
        const patientDelete = jest.fn().mockResolvedValue();
        const adminDelete = jest.fn().mockResolvedValue();
        const staffDelete = jest.fn().mockResolvedValue();
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

            if (name === "staff") {
                return {
                    doc: jest.fn(() => ({
                        get: staffGet,
                        delete: staffDelete
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
        expect(staffDelete).toHaveBeenCalled();
        expect(mockDeleteUser).toHaveBeenCalledWith("admin-1");
    });

    it("should release clinics owned by an admin during account deletion", async () => {
        const patientGet = jest.fn().mockResolvedValue({ exists: false });
        const adminGet = jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ uid: "admin-2", role: "admin" })
        });
        const staffGet = jest.fn().mockResolvedValue({ exists: false });
        const patientDelete = jest.fn().mockResolvedValue();
        const adminDelete = jest.fn().mockResolvedValue();
        const staffDelete = jest.fn().mockResolvedValue();
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

            if (name === "staff") {
                return {
                    doc: jest.fn(() => ({
                        get: staffGet,
                        delete: staffDelete
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
        expect(staffDelete).toHaveBeenCalled();
        expect(mockDeleteUser).toHaveBeenCalledWith("admin-2");
    });
});
=======
>>>>>>> 8990dce747880d8a601e65dc9606fbe4e9a7b29b
