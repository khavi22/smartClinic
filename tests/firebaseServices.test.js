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

