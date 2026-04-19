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

    it("should mark slot as full when taken exceeds capacity", async () => {
        const mockGet = jest.fn();
        const mockWhere = jest.fn();
    
        const mockSnapshot = {
          empty: false,
          forEach: (callback) => {
            for (let i = 0; i < 20; i++) {
              callback({
                data: () => ({
                  timeSlot: "09:00 - 10:00"
                })
              });
            }
          }
        };
    
        mockGet.mockResolvedValue(mockSnapshot);
    
        const queryRef = {
          where: mockWhere,
          get: mockGet
        };
    
        mockWhere.mockReturnValue(queryRef);
        db.collection.mockReturnValue(queryRef);
    
        const result = await getAvailabilityForDate("clinic123", "2026-04-20");
    
        const slot = result.find((s) => s.time === "09:00 - 10:00");
        expect(slot.status).toBe("full");
      });
  });

  describe("createAppointment", () => {
    it("should create a new appointment successfully", async () => {
      const mockAdd = jest.fn();
      const mockGetDuplicate = jest.fn();
      const mockGetCapacity = jest.fn();
      const mockWhere = jest.fn();

      const duplicateQuery = {
        where: jest.fn(),
        get: mockGetDuplicate
      };

      const capacityQuery = {
        where: jest.fn(),
        get: mockGetCapacity
      };

      const appointmentsRef = {
        where: mockWhere,
        add: mockAdd
      };

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
        "clinic123",
        "2026-04-20",
        "09:00 - 10:00",
        "patient123",
        "Community Clinic",
        "123 Main Road"
      );

      expect(mockAdd).toHaveBeenCalled();
      expect(result.id).toBe("appt123");
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
  });

  describe("getUserProfileById", () => {
    it("should return user profile if user exists", async () => {
      const mockGet = jest.fn();
      const mockDoc = jest.fn();

      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({ name: "Martin" })
      });

      mockDoc.mockReturnValue({ get: mockGet });
      db.collection.mockReturnValue({ doc: mockDoc });

      const result = await getUserProfileById("user123");
      expect(result.name).toBe("Martin");
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
        "user123",
        "Martin Mulweli",
        "martin@example.com",
        "patient",
        "0712345678",
        "1234567890123"
      );

      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
        uid: "user123",
        idNumber: "1234567890123"
      }));
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
              expect(mockUpdate).toHaveBeenCalledWith({
                  adminUid: 'test-uid',
                  isActive: true
              });
          });
      });
  });
});