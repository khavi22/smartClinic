const { getAppointmentsByPatientId, getAvailabilityForDate, createAppointment, cancelAppointment, getUserProfileById, createPatientProfile } = require("../services/firebaseService");
const { db, admin} = require("../services/config/firebase");

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

describe("getAvailabilityForDate (service)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {}); // optional
  });

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
    expect(result[9]).toEqual({
      id: 9,
      time: "09:00 - 10:00",
      total: expect.any(Number),
      taken: 0,
      status: "available"
    });
  });

  it("should not filter by clinicId if clinicId is default", async () => {
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
        callback({
          data: () => ({
            timeSlot: "09:00 - 10:00"
          })
        });

        callback({
          data: () => ({
            timeSlot: "09:00 - 10:00"
          })
        });
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

    expect(slot).toBeDefined();
    expect(slot.taken).toBe(2);
    expect(["available", "limited", "full"]).toContain(slot.status);
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

    expect(slot.taken).toBeGreaterThanOrEqual(slot.total); // ✅ FIXED
    expect(slot.status).toBe("full");
  });

  it("should throw error if database fails", async () => {
    const mockGet = jest.fn();
    const mockWhere = jest.fn();

    mockGet.mockRejectedValue(new Error("DB error"));

    const queryRef = {
      where: mockWhere,
      get: mockGet
    };

    mockWhere.mockReturnValue(queryRef);
    db.collection.mockReturnValue(queryRef);

    await expect(
      getAvailabilityForDate("clinic123", "2026-04-20")
    ).rejects.toThrow("DB error");
  });
});

describe("createAppointment (service)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

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

    const duplicateSnapshot = { empty: true };
    const capacitySnapshot = { size: 0 };

    mockGetDuplicate.mockResolvedValue(duplicateSnapshot);
    mockGetCapacity.mockResolvedValue(capacitySnapshot);
    mockAdd.mockResolvedValue({ id: "appt123" });

    duplicateQuery.where
      .mockReturnValueOnce(duplicateQuery)
      .mockReturnValueOnce(duplicateQuery);

    capacityQuery.where
      .mockReturnValueOnce(capacityQuery)
      .mockReturnValueOnce(capacityQuery)
      .mockReturnValueOnce(capacityQuery);

    mockWhere
      .mockReturnValueOnce(duplicateQuery)
      .mockReturnValueOnce(capacityQuery);

    db.collection.mockReturnValue(appointmentsRef);

    const result = await createAppointment(
      "clinic123",
      "2026-04-20",
      "09:00 - 10:00",
      "patient123",
      "Community Clinic",
      "123 Main Road"
    );

    expect(db.collection).toHaveBeenCalledWith("appointments");
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: "clinic123",
        clinicName: "Community Clinic",
        clinicAddress: "123 Main Road",
        date: "2026-04-20",
        timeSlot: "09:00 - 10:00",
        patientId: "patient123",
        status: "booked",
        createdAt: expect.any(String)
      })
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: "appt123",
        clinicId: "clinic123",
        clinicName: "Community Clinic",
        clinicAddress: "123 Main Road",
        date: "2026-04-20",
        timeSlot: "09:00 - 10:00",
        patientId: "patient123",
        status: "booked",
        createdAt: expect.any(String)
      })
    );
  });

  it("should throw error if patient already has a booking for the day", async () => {
    const mockGetDuplicate = jest.fn();
    const mockWhere = jest.fn();

    const duplicateQuery = {
      where: jest.fn(),
      get: mockGetDuplicate
    };

    const appointmentsRef = {
      where: mockWhere,
      add: jest.fn()
    };

    mockGetDuplicate.mockResolvedValue({ empty: false });

    duplicateQuery.where
      .mockReturnValueOnce(duplicateQuery)
      .mockReturnValueOnce(duplicateQuery);

    mockWhere.mockReturnValueOnce(duplicateQuery);

    db.collection.mockReturnValue(appointmentsRef);

    await expect(
      createAppointment(
        "clinic123",
        "2026-04-20",
        "09:00 - 10:00",
        "patient123",
        "Community Clinic",
        "123 Main Road"
      )
    ).rejects.toThrow("You already have a booking for this day.");
  });

  it("should throw error if slot is full", async () => {
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
      add: jest.fn()
    };

    mockGetDuplicate.mockResolvedValue({ empty: true });
    mockGetCapacity.mockResolvedValue({ size: 10 });

    duplicateQuery.where
      .mockReturnValueOnce(duplicateQuery)
      .mockReturnValueOnce(duplicateQuery);

    capacityQuery.where
      .mockReturnValueOnce(capacityQuery)
      .mockReturnValueOnce(capacityQuery)
      .mockReturnValueOnce(capacityQuery);

    mockWhere
      .mockReturnValueOnce(duplicateQuery)
      .mockReturnValueOnce(capacityQuery);

    db.collection.mockReturnValue(appointmentsRef);

    await expect(
      createAppointment(
        "clinic123",
        "2026-04-20",
        "09:00 - 10:00",
        "patient123",
        "Community Clinic",
        "123 Main Road"
      )
    ).rejects.toThrow("This slot is full.");
  });

  it("should skip duplicate check when rescheduling", async () => {
    const mockAdd = jest.fn();
    const mockGetCapacity = jest.fn();
    const mockWhere = jest.fn();

    const capacityQuery = {
      where: jest.fn(),
      get: mockGetCapacity
    };

    const appointmentsRef = {
      where: mockWhere,
      add: mockAdd
    };

    mockGetCapacity.mockResolvedValue({ size: 0 });
    mockAdd.mockResolvedValue({ id: "appt999" });

    capacityQuery.where
      .mockReturnValueOnce(capacityQuery)
      .mockReturnValueOnce(capacityQuery)
      .mockReturnValueOnce(capacityQuery);

    mockWhere.mockReturnValueOnce(capacityQuery);

    db.collection.mockReturnValue(appointmentsRef);

    const result = await createAppointment(
      "clinic123",
      "2026-04-20",
      "11:00 - 12:00",
      "patient123",
      "Community Clinic",
      "123 Main Road",
      true
    );

    expect(mockAdd).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        id: "appt999",
        patientId: "patient123",
        timeSlot: "11:00 - 12:00"
      })
    );
  });

  it("should use default clinic values if clinic data is missing", async () => {
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
    mockAdd.mockResolvedValue({ id: "appt555" });

    duplicateQuery.where
      .mockReturnValueOnce(duplicateQuery)
      .mockReturnValueOnce(duplicateQuery);

    capacityQuery.where
      .mockReturnValueOnce(capacityQuery)
      .mockReturnValueOnce(capacityQuery);

    mockWhere
      .mockReturnValueOnce(duplicateQuery)
      .mockReturnValueOnce(capacityQuery);

    db.collection.mockReturnValue(appointmentsRef);

    const result = await createAppointment(
      "default",
      "2026-04-20",
      "14:00 - 15:00",
      "patient123"
    );

    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: "default",
        clinicName: "Unknown Clinic",
        clinicAddress: "N/A"
      })
    );

    expect(result).toEqual(
      expect.objectContaining({
        clinicId: "default",
        clinicName: "Unknown Clinic",
        clinicAddress: "N/A"
      })
    );
  });

  it("should throw error if database fails", async () => {
    const mockGetDuplicate = jest.fn();
    const mockWhere = jest.fn();

    const duplicateQuery = {
      where: jest.fn(),
      get: mockGetDuplicate
    };

    const appointmentsRef = {
      where: mockWhere,
      add: jest.fn()
    };

    mockGetDuplicate.mockRejectedValue(new Error("DB error"));

    duplicateQuery.where
      .mockReturnValueOnce(duplicateQuery)
      .mockReturnValueOnce(duplicateQuery);

    mockWhere.mockReturnValueOnce(duplicateQuery);

    db.collection.mockReturnValue(appointmentsRef);

    await expect(
      createAppointment(
        "clinic123",
        "2026-04-20",
        "09:00 - 10:00",
        "patient123",
        "Community Clinic",
        "123 Main Road"
      )
    ).rejects.toThrow("DB error");
  });
});

describe("cancelAppointment (service)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should cancel an appointment successfully", async () => {
    const mockGet = jest.fn();
    const mockUpdate = jest.fn();
    const mockDoc = jest.fn();

    const bookingDoc = {
      exists: true
    };

    mockGet.mockResolvedValue(bookingDoc);
    mockUpdate.mockResolvedValue();

    const bookingRef = {
      get: mockGet,
      update: mockUpdate
    };

    mockDoc.mockReturnValue(bookingRef);

    db.collection.mockReturnValue({
      doc: mockDoc
    });

    const result = await cancelAppointment("appt123");

    expect(db.collection).toHaveBeenCalledWith("appointments");
    expect(mockDoc).toHaveBeenCalledWith("appt123");
    expect(mockGet).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({
      status: "cancelled",
      updatedAt: expect.any(Date)
    });

    expect(result).toEqual({
      success: true,
      message: "Booking cancelled successfully"
    });
  });

  it("should throw error if booking is not found", async () => {
    const mockGet = jest.fn();
    const mockDoc = jest.fn();

    const bookingDoc = {
      exists: false
    };

    mockGet.mockResolvedValue(bookingDoc);

    const bookingRef = {
      get: mockGet,
      update: jest.fn()
    };

    mockDoc.mockReturnValue(bookingRef);

    db.collection.mockReturnValue({
      doc: mockDoc
    });

    await expect(cancelAppointment("appt999")).rejects.toThrow("Booking not found");
  });

  it("should throw error if database fails while reading", async () => {
    const mockGet = jest.fn();
    const mockDoc = jest.fn();

    mockGet.mockRejectedValue(new Error("DB error"));

    const bookingRef = {
      get: mockGet,
      update: jest.fn()
    };

    mockDoc.mockReturnValue(bookingRef);

    db.collection.mockReturnValue({
      doc: mockDoc
    });

    await expect(cancelAppointment("appt123")).rejects.toThrow("DB error");
  });

  it("should throw error if database fails while updating", async () => {
    const mockGet = jest.fn();
    const mockUpdate = jest.fn();
    const mockDoc = jest.fn();

    const bookingDoc = {
      exists: true
    };

    mockGet.mockResolvedValue(bookingDoc);
    mockUpdate.mockRejectedValue(new Error("Update failed"));

    const bookingRef = {
      get: mockGet,
      update: mockUpdate
    };

    mockDoc.mockReturnValue(bookingRef);

    db.collection.mockReturnValue({
      doc: mockDoc
    });

    await expect(cancelAppointment("appt123")).rejects.toThrow("Update failed");
  });
});

describe("getUserProfileById (service)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should return user profile if user exists", async () => {
    const mockGet = jest.fn();
    const mockDoc = jest.fn();

    const mockDocSnap = {
      exists: true,
      id: "user123",
      data: () => ({
        name: "Martin",
        email: "martin@example.com"
      })
    };

    mockGet.mockResolvedValue(mockDocSnap);

    const docRef = {
      get: mockGet
    };

    mockDoc.mockReturnValue(docRef);

    db.collection.mockReturnValue({
      doc: mockDoc
    });

    const result = await getUserProfileById("user123");

    expect(db.collection).toHaveBeenCalledWith("patients");
    expect(mockDoc).toHaveBeenCalledWith("user123");
    expect(mockGet).toHaveBeenCalled();

    expect(result).toEqual({
      id: "user123",
      name: "Martin",
      email: "martin@example.com"
    });
  });

  it("should return null if user does not exist", async () => {
    const mockGet = jest.fn();
    const mockDoc = jest.fn();

    const mockDocSnap = {
      exists: false
    };

    mockGet.mockResolvedValue(mockDocSnap);

    const docRef = {
      get: mockGet
    };

    mockDoc.mockReturnValue(docRef);

    db.collection.mockReturnValue({
      doc: mockDoc
    });

    const result = await getUserProfileById("user999");

    expect(result).toBeNull();
  });

  it("should throw error if database fails", async () => {
    const mockGet = jest.fn();
    const mockDoc = jest.fn();

    mockGet.mockRejectedValue(new Error("DB error"));

    const docRef = {
      get: mockGet
    };

    mockDoc.mockReturnValue(docRef);

    db.collection.mockReturnValue({
      doc: mockDoc
    });

    await expect(getUserProfileById("user123")).rejects.toThrow("DB error");
  });
});

describe("createPatientProfile (service)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("should create a patient profile successfully", async () => {
    const mockSet = jest.fn();
    const mockDoc = jest.fn();

    const mockTimestamp = "mock-server-timestamp";

    const docRef = {
      set: mockSet
    };

    mockSet.mockResolvedValue();
    mockDoc.mockReturnValue(docRef);

    db.collection.mockReturnValue({
      doc: mockDoc
    });

    admin.firestore = {
      FieldValue: {
        serverTimestamp: jest.fn().mockReturnValue(mockTimestamp)
      }
    };

    const result = await createPatientProfile(
      "user123",
      "Martin Mulweli",
      "martin@example.com",
      "patient",
      "0712345678",
      "1234567890123"
    );

    expect(db.collection).toHaveBeenCalledWith("patients");
    expect(mockDoc).toHaveBeenCalledWith("user123");
    expect(admin.firestore.FieldValue.serverTimestamp).toHaveBeenCalled();

    expect(mockSet).toHaveBeenCalledWith({
      uid: "user123",
      fullName: "Martin Mulweli",
      email: "martin@example.com",
      role: "patient",
      phone: "0712345678",
      idNumber: "1234567890123",
      createdAt: mockTimestamp
    });

    expect(result).toEqual({
      uid: "user123",
      fullName: "Martin Mulweli",
      email: "martin@example.com",
      role: "patient",
      phone: "0712345678",
      idNumber: "1234567890123",
      createdAt: mockTimestamp
    });
  });

  it("should use N/A if idNumber is not provided", async () => {
    const mockSet = jest.fn();
    const mockDoc = jest.fn();

    const mockTimestamp = "mock-server-timestamp";

    const docRef = {
      set: mockSet
    };

    mockSet.mockResolvedValue();
    mockDoc.mockReturnValue(docRef);

    db.collection.mockReturnValue({
      doc: mockDoc
    });

    admin.firestore = {
      FieldValue: {
        serverTimestamp: jest.fn().mockReturnValue(mockTimestamp)
      }
    };

    const result = await createPatientProfile(
      "user123",
      "Martin Mulweli",
      "martin@example.com",
      "patient",
      "0712345678"
    );

    expect(mockSet).toHaveBeenCalledWith({
      uid: "user123",
      fullName: "Martin Mulweli",
      email: "martin@example.com",
      role: "patient",
      phone: "0712345678",
      idNumber: "N/A",
      createdAt: mockTimestamp
    });

    expect(result).toEqual({
      uid: "user123",
      fullName: "Martin Mulweli",
      email: "martin@example.com",
      role: "patient",
      phone: "0712345678",
      idNumber: "N/A",
      createdAt: mockTimestamp
    });
  });

  it("should throw error if database fails", async () => {
    const mockSet = jest.fn();
    const mockDoc = jest.fn();

    const docRef = {
      set: mockSet
    };

    mockSet.mockRejectedValue(new Error("DB error"));
    mockDoc.mockReturnValue(docRef);

    db.collection.mockReturnValue({
      doc: mockDoc
    });

    admin.firestore = {
      FieldValue: {
        serverTimestamp: jest.fn().mockReturnValue("mock-server-timestamp")
      }
    };

    await expect(
      createPatientProfile(
        "user123",
        "Martin Mulweli",
        "martin@example.com",
        "patient",
        "0712345678"
      )
    ).rejects.toThrow("DB error");
  });

  it("should ignore appointments with invalid timeSlot", async () => {
    const mockGet = jest.fn();
    const mockWhere = jest.fn();

    const mockSnapshot = {
      empty: false,
      forEach: (callback) => {
        callback({
          data: () => ({
            timeSlot: "99:00 - 100:00" // ❌ invalid slot
          })
        });
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

    expect(slot.taken).toBe(0); // nothing should change
  });

  it("should use default clinicId when clinicId is not provided", async () => {
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
    mockAdd.mockResolvedValue({ id: "appt999" });

    duplicateQuery.where
      .mockReturnValueOnce(duplicateQuery)
      .mockReturnValueOnce(duplicateQuery);

    capacityQuery.where
      .mockReturnValueOnce(capacityQuery)
      .mockReturnValueOnce(capacityQuery);

    mockWhere
      .mockReturnValueOnce(duplicateQuery)
      .mockReturnValueOnce(capacityQuery);

    db.collection.mockReturnValue(appointmentsRef);

    const result = await createAppointment(
      undefined,   // 🔥 IMPORTANT (not "default", not string)
      "2026-04-20",
      "09:00 - 10:00",
      "patient123"
    );

    expect(result.clinicId).toBe("default");
  });

});