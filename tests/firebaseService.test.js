const { getAppointmentsByPatientId } = require("../services/firebaseService");
const { db } = require("../services/config/firebase");

jest.mock("../services/config/firebase", () => ({
  db: {
    collection: jest.fn()
  },
  admin: {}
}));

describe("getAppointmentsByPatientId (service)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

// ======================= ADMIN =======================

const {
    createUserProfile,
    getClinicIdFromAdminCode,
    claimClinic
} = require('../services/firebaseService');

describe('firebaseService - Admin', () => {
    let mockGet, mockWhere, mockSet, mockUpdate, mockDoc, mockCollection;

    beforeEach(() => {
        jest.clearAllMocks();

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
        it('should write base and role data to users collection with a timestamp', async () => {
            const userData = { uid: 'test-uid', fullName: 'John Doe', email: 'john@example.com', phone: '1234567890', role: 'admin' };
            const roleData = { adminCode: 'ADM-A1B2C3', clinicId: 'clinic-123' };

            await createUserProfile(userData, roleData);

            expect(db.collection).toHaveBeenCalledWith('users');
            expect(mockDoc).toHaveBeenCalledWith('test-uid');
            expect(mockSet).toHaveBeenCalledWith({
                ...userData,
                ...roleData,
                createdAt: undefined // admin is mocked as {} so serverTimestamp returns undefined
            });
        });

        it('should throw when Firestore set fails', async () => {
            mockSet.mockRejectedValue(new Error('Firestore write failed'));

            await expect(createUserProfile({ uid: 'test-uid' }, {}))
                .rejects
                .toThrow('Firestore write failed');
        });
    });

    describe('getClinicIdFromAdminCode', () => {
        it('should return clinicId when code is valid and unused', async () => {
            mockGet.mockResolvedValue({ empty: false, docs: [{ id: 'clinic-123' }] });

            const result = await getClinicIdFromAdminCode('ADM-A1B2C3');

            expect(db.collection).toHaveBeenCalledWith('clinics');
            expect(mockWhere).toHaveBeenCalledWith('adminCode', '==', 'ADM-A1B2C3');
            expect(mockWhere).toHaveBeenCalledWith('adminUid', '==', null);
            expect(mockWhere).toHaveBeenCalledWith('isActive', '==', false);
            expect(result).toBe('clinic-123');
        });

        it('should return null when code is invalid', async () => {
            mockGet.mockResolvedValue({ empty: true, docs: [] });

            const result = await getClinicIdFromAdminCode('ADM-INVALID');

            expect(result).toBeNull();
        });

        it('should return null when code is already used', async () => {
            mockGet.mockResolvedValue({ empty: true, docs: [] });

            const result = await getClinicIdFromAdminCode('ADM-USED11');

            expect(result).toBeNull();
        });

        it('should throw when Firestore query fails', async () => {
            mockGet.mockRejectedValue(new Error('Firestore query failed'));

            await expect(getClinicIdFromAdminCode('ADM-A1B2C3'))
                .rejects
                .toThrow('Firestore query failed');
        });
    });

    describe('claimClinic', () => {
        it('should update clinic with adminUid and set isActive to true', async () => {
            await claimClinic('clinic-123', 'test-uid');

            expect(db.collection).toHaveBeenCalledWith('clinics');
            expect(mockDoc).toHaveBeenCalledWith('clinic-123');
            expect(mockUpdate).toHaveBeenCalledWith({
                adminUid: 'test-uid',
                isActive: true
            });
        });

        it('should throw when Firestore update fails', async () => {
            mockUpdate.mockRejectedValue(new Error('Firestore update failed'));

            await expect(claimClinic('clinic-123', 'test-uid'))
                .rejects
                .toThrow('Firestore update failed');
        });
    });
});