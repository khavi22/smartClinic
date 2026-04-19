const { 
    getAppointmentsByPatientId, 
    getAvailabilityForDate, 
    createAppointment, 
    cancelAppointment, 
    getUserProfileById, 
    createPatientProfile,
    createUserProfile,
    getClinicIdFromAdminCode,
    claimClinic
} = require("../services/firebaseService");
const { db, admin } = require("../services/config/firebase");

jest.mock("../services/config/firebase", () => ({
  db: {
    collection: jest.fn()
  },
  admin: {
    firestore: {
        FieldValue: {
            serverTimestamp: jest.fn().mockReturnValue("mock-server-timestamp")
        }
    }
  }
}));

describe("firebaseService Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("getAppointmentsByPatientId", () => {
    it("should return appointments for a patientId", async () => {
      const mockGet = jest.fn();
      const mockWhere = jest.fn();

      const mockSnapshot = {
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
      };

      mockGet.mockResolvedValue(mockSnapshot);
      mockWhere.mockReturnValue({ get: mockGet });
      db.collection.mockReturnValue({ where: mockWhere });

      const result = await getAppointmentsByPatientId("patient123");

      expect(db.collection).toHaveBeenCalledWith("appointments");
      expect(mockWhere).toHaveBeenCalledWith("patientId", "==", "patient123");
      expect(mockGet).toHaveBeenCalled();

      expect(result).toEqual([
        { id: "appt1", patientId: "patient123", status: "booked" },
        { id: "appt2", patientId: "patient123", status: "pending" }
      ]);
    });

    it("should return empty array if no appointments found", async () => {
      const mockGet = jest.fn();
      const mockWhere = jest.fn();

      const mockSnapshot = {
        forEach: jest.fn()
      };

      mockGet.mockResolvedValue(mockSnapshot);
      mockWhere.mockReturnValue({ get: mockGet });
      db.collection.mockReturnValue({ where: mockWhere });

      const result = await getAppointmentsByPatientId("patient999");

      expect(result).toEqual([]);
    });

    it("should throw error if database fails", async () => {
        const mockGet = jest.fn();
        const mockWhere = jest.fn();
    
        mockGet.mockRejectedValue(new Error("DB error"));
        mockWhere.mockReturnValue({ get: mockGet });
        db.collection.mockReturnValue({ where: mockWhere });
    
        await expect(getAppointmentsByPatientId("patient123")).rejects.toThrow("DB error");
    });
  });

  describe("getAvailabilityForDate", () => {
    it("should return all default slots if no appointments found", async () => {
      const mockGet = jest.fn();
      const mockWhere = jest.fn();

      const mockSnapshot = {
        empty: true,
        forEach: jest.fn()
      };

      mockGet.mockResolvedValue(mockSnapshot);

      const queryRef = {
        where: mockWhere,
        get: mockGet
      };

      mockWhere.mockReturnValue(queryRef);
      db.collection.mockReturnValue(queryRef);

      const result = await getAvailabilityForDate("clinic123", "2026-04-20");

      expect(result).toHaveLength(24);
      expect(result[9].time).toBe("09:00 - 10:00");
    });

    it("should not filter by clinicId if clinicId is default", async () => {
        const mockGet = jest.fn();
        const mockWhere = jest.fn();
        mockGet.mockResolvedValue({ empty: true, forEach: jest.fn() });
        const queryRef = { where: mockWhere, get: mockGet };
        mockWhere.mockReturnValue(queryRef);
        db.collection.mockReturnValue(queryRef);

        await getAvailabilityForDate("default", "2026-04-20");

        expect(mockWhere).toHaveBeenNthCalledWith(1, "date", "==", "2026-04-20");
        expect(mockWhere).toHaveBeenNthCalledWith(2, "status", "==", "booked");
        expect(mockWhere).not.toHaveBeenCalledWith("clinicId", "==", "default");
    });

    it("should update slot taken count and status when appointments exist", async () => {
        const mockGet = jest.fn();
        const mockWhere = jest.fn();
        const mockSnapshot = {
          empty: false,
          forEach: (callback) => {
            callback({ data: () => ({ timeSlot: "09:00 - 10:00" }) });
            callback({ data: () => ({ timeSlot: "09:00 - 10:00" }) });
          }
        };
        mockGet.mockResolvedValue(mockSnapshot);
        const queryRef = { where: mockWhere, get: mockGet };
        mockWhere.mockReturnValue(queryRef);
        db.collection.mockReturnValue(queryRef);

        const result = await getAvailabilityForDate("clinic123", "2026-04-20");
        const slot = result.find((s) => s.time === "09:00 - 10:00");
        expect(slot.taken).toBe(2);
    });

    it("should mark slot as full when taken exceeds capacity", async () => {
        const mockGet = jest.fn();
        const mockWhere = jest.fn();
        const mockSnapshot = {
          empty: false,
          forEach: (callback) => {
            for (let i = 0; i < 20; i++) {
              callback({ data: () => ({ timeSlot: "09:00 - 10:00" }) });
            }
          }
        };
        mockGet.mockResolvedValue(mockSnapshot);
        const queryRef = { where: mockWhere, get: mockGet };
        mockWhere.mockReturnValue(queryRef);
        db.collection.mockReturnValue(queryRef);

        const result = await getAvailabilityForDate("clinic123", "2026-04-20");
        const slot = result.find((s) => s.time === "09:00 - 10:00");
        expect(slot.status).toBe("full");
    });

    it("should throw error if database fails", async () => {
        const mockGet = jest.fn();
        const mockWhere = jest.fn();
        mockGet.mockRejectedValue(new Error("DB error"));
        const queryRef = { where: mockWhere, get: mockGet };
        mockWhere.mockReturnValue(queryRef);
        db.collection.mockReturnValue(queryRef);

        await expect(getAvailabilityForDate("clinic123", "2026-04-20")).rejects.toThrow("DB error");
    });
  });

  describe("createAppointment", () => {
    it("should create a new appointment successfully", async () => {
      const mockAdd = jest.fn();
      const mockGetDuplicate = jest.fn();
      const mockGetCapacity = jest.fn();
      const mockWhere = jest.fn();

      const duplicateQuery = { where: jest.fn(), get: mockGetDuplicate };
      const capacityQuery = { where: jest.fn(), get: mockGetCapacity };
      const appointmentsRef = { where: mockWhere, add: mockAdd };

      mockGetDuplicate.mockResolvedValue({ empty: true });
      mockGetCapacity.mockResolvedValue({ size: 0 });
      mockAdd.mockResolvedValue({ id: "appt123" });

      duplicateQuery.where.mockReturnValue(duplicateQuery);
      capacityQuery.where.mockReturnValue(capacityQuery);
      mockWhere.mockImplementation((field, op, val) => {
          if (field === "patientId") return duplicateQuery;
          return capacityQuery;
      });

      db.collection.mockReturnValue(appointmentsRef);

      const result = await createAppointment(
        "clinic123", "2026-04-20", "09:00 - 10:00", "patient123", "Clinic", "Addr"
      );

      expect(mockAdd).toHaveBeenCalled();
      expect(result.id).toBe("appt123");
    });

    it("should throw error if patient already has a booking for the day", async () => {
        const mockGetDuplicate = jest.fn();
        const mockWhere = jest.fn();
        const duplicateQuery = { where: jest.fn(), get: mockGetDuplicate };
        const appointmentsRef = { where: mockWhere, add: jest.fn() };
        mockGetDuplicate.mockResolvedValue({ empty: false });
        duplicateQuery.where.mockReturnValue(duplicateQuery);
        mockWhere.mockReturnValue(duplicateQuery);
        db.collection.mockReturnValue(appointmentsRef);

        await expect(createAppointment("c1", "2026-04-20", "09:00", "p1")).rejects.toThrow("You already have a booking for this day.");
    });

    it("should throw error if slot is full", async () => {
        const mockGetDuplicate = jest.fn();
        const mockGetCapacity = jest.fn();
        const mockWhere = jest.fn();
        const duplicateQuery = { where: jest.fn(), get: mockGetDuplicate };
        const capacityQuery = { where: jest.fn(), get: mockGetCapacity };
        mockGetDuplicate.mockResolvedValue({ empty: true });
        mockGetCapacity.mockResolvedValue({ size: 10 });
        duplicateQuery.where.mockReturnValue(duplicateQuery);
        capacityQuery.where.mockReturnValue(capacityQuery);
        mockWhere.mockImplementation((field) => field === "patientId" ? duplicateQuery : capacityQuery);
        db.collection.mockReturnValue({ where: mockWhere, add: jest.fn() });

        await expect(createAppointment("c1", "2026-04-20", "09:00", "p1")).rejects.toThrow("This slot is full.");
    });

    it("should throw error if database fails", async () => {
        const mockWhere = jest.fn();
        db.collection.mockReturnValue({ where: mockWhere });
        mockWhere.mockImplementation(() => { throw new Error("DB error"); });
        await expect(createAppointment("c1", "2026-04-20", "09:00", "p1")).rejects.toThrow("DB error");
    });
  });

  describe("cancelAppointment", () => {
    it("should cancel an appointment successfully", async () => {
      const mockGet = jest.fn();
      const mockUpdate = jest.fn();
      const mockDoc = jest.fn();

      mockGet.mockResolvedValue({ exists: true });
      mockUpdate.mockResolvedValue();

      const bookingRef = { get: mockGet, update: mockUpdate };
      mockDoc.mockReturnValue(bookingRef);
      db.collection.mockReturnValue({ doc: mockDoc });

      const result = await cancelAppointment("appt123");

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "cancelled" }));
      expect(result.success).toBe(true);
    });

    it("should throw error if booking is not found", async () => {
        const mockGet = jest.fn();
        const mockDoc = jest.fn();
        mockGet.mockResolvedValue({ exists: false });
        mockDoc.mockReturnValue({ get: mockGet, update: jest.fn() });
        db.collection.mockReturnValue({ doc: mockDoc });

        await expect(cancelAppointment("appt999")).rejects.toThrow("Booking not found");
    });

    it("should throw error if database fails while updating", async () => {
        const mockGet = jest.fn();
        const mockUpdate = jest.fn();
        mockGet.mockResolvedValue({ exists: true });
        mockUpdate.mockRejectedValue(new Error("Update failed"));
        db.collection.mockReturnValue({ doc: () => ({ get: mockGet, update: mockUpdate }) });

        await expect(cancelAppointment("appt123")).rejects.toThrow("Update failed");
    });
  });

  describe("getUserProfileById", () => {
    it("should return profile from 'users' if it exists", async () => {
      const mockGet = jest.fn();
      const mockDoc = jest.fn();
      mockGet.mockResolvedValue({ exists: true, data: () => ({ role: "admin" }) });
      mockDoc.mockReturnValue({ get: mockGet });
      db.collection.mockReturnValue({ doc: mockDoc });

      const result = await getUserProfileById("user123");
      expect(db.collection).toHaveBeenCalledWith("users");
      expect(result.role).toBe("admin");
    });

    it("should return profile from 'patients' if not in 'users'", async () => {
        const mockGetUsers = jest.fn();
        const mockGetPatients = jest.fn();
        const mockDoc = jest.fn();

        mockGetUsers.mockResolvedValue({ exists: false });
        mockGetPatients.mockResolvedValue({ exists: true, data: () => ({ role: "patient" }) });
        
        mockDoc.mockReturnValue({ get: mockGetUsers }); // first call
        mockDoc.mockReturnValueOnce({ get: mockGetUsers }); 
        mockDoc.mockReturnValueOnce({ get: mockGetPatients });

        db.collection.mockImplementation((name) => ({ doc: mockDoc }));

        const result = await getUserProfileById("user456");
        expect(db.collection).toHaveBeenCalledWith("users");
        expect(db.collection).toHaveBeenCalledWith("patients");
        expect(result.role).toBe("patient");
    });

    it("should return null if not in either collection", async () => {
        const mockGet = jest.fn();
        mockGet.mockResolvedValue({ exists: false });
        db.collection.mockReturnValue({ doc: () => ({ get: mockGet }) });

        const result = await getUserProfileById("user999");
        expect(result).toBeNull();
    });
  });

  describe("createPatientProfile", () => {
    it("should create a patient profile successfully", async () => {
      const mockSet = jest.fn();
      const mockDoc = jest.fn();

      mockSet.mockResolvedValue();
      mockDoc.mockReturnValue({ set: mockSet });
      db.collection.mockReturnValue({ doc: mockDoc });

      const result = await createPatientProfile(
        "user123", "Martin Mulweli", "martin@example.com", "patient", "0712345678", "1234567890123"
      );

      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ uid: "user123", idNumber: "1234567890123" }));
      expect(result.uid).toBe("user123");
    });
  });

  describe("Admin Functions", () => {
      let mockGet, mockWhere, mockSet, mockUpdate, mockDoc, mockCollection;

      beforeEach(() => {
          mockGet = jest.fn();
          mockSet = jest.fn();
          mockUpdate = jest.fn();
          mockWhere = jest.fn();
          mockDoc = jest.fn(() => ({ set: mockSet, get: mockGet, update: mockUpdate }));
          mockCollection = jest.fn(() => ({ doc: mockDoc, where: mockWhere }));
          mockWhere.mockReturnValue({ where: mockWhere, get: mockGet });

          db.collection.mockImplementation(mockCollection);
      });

      describe('createUserProfile', () => {
          it('should write base and role data to users collection', async () => {
              const userData = { uid: 'test-uid', fullName: 'John Doe', role: 'admin' };
              const roleData = { clinicId: 'clinic-123' };
              await createUserProfile(userData, roleData);
              expect(db.collection).toHaveBeenCalledWith('users');
              expect(mockDoc).toHaveBeenCalledWith('test-uid');
              expect(mockSet).toHaveBeenCalled();
          });
      });

      describe('getClinicIdFromAdminCode', () => {
          it('should return clinicId when code is valid and unused', async () => {
              mockGet.mockResolvedValue({ empty: false, docs: [{ id: 'clinic-123' }] });
              const result = await getClinicIdFromAdminCode('ADM-A1B2C3');
              expect(db.collection).toHaveBeenCalledWith('clinics');
              expect(result).toBe('clinic-123');
          });
      });

      describe('claimClinic', () => {
          it('should update clinic with adminUid and set isActive to true', async () => {
              await claimClinic('clinic-123', 'test-uid');
              expect(db.collection).toHaveBeenCalledWith('clinics');
              expect(mockUpdate).toHaveBeenCalledWith({ adminUid: 'test-uid', isActive: true });
          });
      });
  });
});