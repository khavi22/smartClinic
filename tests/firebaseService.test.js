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

describe("firebaseService Tests", () => {
    let mockGet, mockWhere, mockSet, mockUpdate, mockDoc, mockAdd, mockDelete;

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
        it("should throw error if db fails during availability check", async () => {
            mockGet.mockRejectedValue(new Error("Avail Fail"));
            await expect(getAvailabilityForDate("c1", "d1")).rejects.toThrow("Avail Fail");
        });
    });

    describe("createAppointment", () => {
        it("should throw if duplicate found (isReschedule=false)", async () => {
            mockGet.mockResolvedValueOnce({ empty: false }); // duplicate check
            await expect(createAppointment("c1", "d1", "t1", "p1")).rejects.toThrow("booking for this day");
        });

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
        });
    });

    describe("cancelAppointment", () => {
        it("should update status and updatedAt", async () => {
            mockGet.mockResolvedValueOnce({ exists: true, data: () => ({}) });
            await cancelAppointment("a1");
            expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "cancelled" }));
        });
    });

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
        });
    });
});
