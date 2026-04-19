const { getAvailabilityForDate, updateClinicOperatingHours } = require("../services/firebaseService");
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

describe("Operating Hours Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should filter availability based on clinic operating hours", async () => {
    const clinicId = "test-clinic-123";
    const dateStr = "2026-04-20"; // A Monday

    const mockClinicData = {
      operatingHours: {
        monday: { open: "09:00", close: "12:00", isOpen: true }
      }
    };

    const mockGet = jest.fn();
    const mockDoc = jest.fn();

    // Setup chained mock for where()
    const mockQuery = {
        where: jest.fn().mockReturnThis(),
        get: mockGet
    };

    // Mock clinic fetch
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => mockClinicData
    });

    // Mock appointments fetch (empty)
    mockGet.mockResolvedValueOnce({
      empty: true,
      forEach: jest.fn()
    });

    mockDoc.mockReturnValue({ get: mockGet });
    
    db.collection.mockImplementation((name) => {
        if (name === "clinics") return { doc: mockDoc };
        if (name === "appointments") return mockQuery;
    });

    const result = await getAvailabilityForDate(clinicId, dateStr);

    // Should only have hours 09:00, 10:00, 11:00
    expect(result).toHaveLength(3);
    expect(result[0].time).toBe("09:00 - 10:00");
    expect(result[result.length - 1].time).toBe("11:00 - 12:00");
  });

  it("should return no slots if the clinic is closed on that day", async () => {
    const clinicId = "test-clinic-123";
    const dateStr = "2026-04-19"; // A Sunday

    const mockClinicData = {
      operatingHours: {
        sunday: { open: "00:00", close: "00:00", isOpen: false }
      }
    };

    const mockGet = jest.fn().mockResolvedValue({
      exists: true,
      data: () => mockClinicData
    });

    db.collection.mockReturnValue({ doc: () => ({ get: mockGet }) });

    const result = await getAvailabilityForDate(clinicId, dateStr);
    expect(result).toEqual([]);
  });

  it("should update clinic operating hours successfully", async () => {
    const clinicId = "test-clinic-123";
    const newHours = {
        monday: { open: "10:00", close: "15:00", isOpen: true }
    };

    const mockUpdate = jest.fn().mockResolvedValue();
    db.collection.mockReturnValue({ doc: () => ({ update: mockUpdate }) });

    await updateClinicOperatingHours(clinicId, newHours);

    expect(db.collection).toHaveBeenCalledWith("clinics");
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        operatingHours: newHours,
        updatedAt: "mock-server-timestamp"
    }));
  });
});
