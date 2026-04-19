const { getAppointmentsByPatientId } = require("../services/firebaseService");
const { db } = require("../services/config/firebase");
const { createAdminProfile } = require('"../services/firebaseService"');

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

// Mock firebase-admin
const mockSet = jest.fn();
const mockDoc = jest.fn(() => ({ set: mockSet }));
const mockCollection = jest.fn(() => ({ doc: mockDoc }));
const mockServerTimestamp = jest.fn(() => 'mock-timestamp');

jest.mock('firebase-admin', () => ({
    firestore: Object.assign(
        jest.fn(() => ({ collection: mockCollection })),
        {
            FieldValue: { serverTimestamp: mockServerTimestamp }
        }
    )
}));

// Mock your db instance
jest.mock('./firebaseConfig', () => ({
    db: { collection: mockCollection }
}));

describe('createAdminProfile - Firebase Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should write admin data with a server timestamp to the admin collection', async () => {
        const adminData = {
            uid: 'test-uid',
            fullName: 'John Doe',
            email: 'john@example.com',
            phone: '1234567890',
            adminCode: 'ADM001',
            assignedClinic: 'Clinic A'
        };

        await createAdminProfile(adminData);

        expect(mockCollection).toHaveBeenCalledWith('admin');
        expect(mockDoc).toHaveBeenCalledWith('test-uid');
        expect(mockSet).toHaveBeenCalledWith({
            ...adminData,
            createdAt: 'mock-timestamp'
        });
    });

    it('should throw when Firestore set fails', async () => {
        mockSet.mockRejectedValue(new Error('Firestore write failed'));

        await expect(createAdminProfile({ uid: 'test-uid' }))
            .rejects
            .toThrow('Firestore write failed');
    });
});