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

    describe("deleteUserAccount", () => {
        it("should handle roles and cleanup", async () => {
            mockGet.mockResolvedValueOnce({ exists: true, data: () => ({ role: "admin" }) });
            mockGet.mockResolvedValueOnce({ docs: [{ ref: { update: mockUpdate } }] });
            await deleteUserAccount("u1");
            expect(mockUpdate).toHaveBeenCalled();
        });
    });
});
