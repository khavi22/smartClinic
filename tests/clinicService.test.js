const mockServerTimestamp = jest.fn(() => "mock-server-timestamp");

jest.mock("../services/config/firebase", () => ({
    db: {
        collection: jest.fn()
    },
    admin: {
        auth: jest.fn(() => ({})),
        firestore: {
            FieldValue: {
                serverTimestamp: mockServerTimestamp
            }
        }
    }
}));
const clinicService = jest.requireActual("../services/clinicService");
const { updateClinicSlotCapacity, getStaffUtilisationData } = require("../services/clinicService");
const { db } = require("../services/config/firebase");

// Suite: groups related coverage for updateClinicSlotCapacity.
describe("updateClinicSlotCapacity", () => {
    // Setup: resets shared mocks and test data before each case in this scope.
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Test: checks should throw if clinicId is 'default'. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
    it("should throw if clinicId is 'default'", async () => {
        await expect(updateClinicSlotCapacity("default", 10))
            .rejects.toThrow("Invalid clinic ID.");
    });

    // Test: checks should throw if clinicId is empty. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
    it("should throw if clinicId is empty", async () => {
        await expect(updateClinicSlotCapacity("", 10))
            .rejects.toThrow("Invalid clinic ID.");
    });

    // Test: checks should throw if slotCapacity is a float. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
    it("should throw if slotCapacity is a float", async () => {
        await expect(updateClinicSlotCapacity("c1", 10.5))
            .rejects.toThrow("Slot capacity must be a positive integer.");
    });

    // Test: checks should throw if slotCapacity is 0. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
    it("should throw if slotCapacity is 0", async () => {
        await expect(updateClinicSlotCapacity("c1", 0))
            .rejects.toThrow("Slot capacity must be a positive integer.");
    });

    // Test: checks should throw if slotCapacity is negative. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
    it("should throw if slotCapacity is negative", async () => {
        await expect(updateClinicSlotCapacity("c1", -5))
            .rejects.toThrow("Slot capacity must be a positive integer.");
    });

    // Test: checks should throw if clinic does not exist. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
    it("should throw if clinic does not exist", async () => {
        const mockUpdate = jest.fn();

        db.collection.mockReturnValue({
            doc: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({ exists: false }),
                update: mockUpdate
            }))
        });

        await expect(updateClinicSlotCapacity("c1", 10))
            .rejects.toThrow("Clinic not found.");

        expect(mockUpdate).not.toHaveBeenCalled();
    });

    // Test: checks should update slotCapacity and return clinicId and slotCapacity on success. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
    it("should update slotCapacity and return clinicId and slotCapacity on success", async () => {
        const mockUpdate = jest.fn().mockResolvedValue();

        db.collection.mockReturnValue({
            doc: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({ exists: true }),
                update: mockUpdate
            }))
        });

        const result = await updateClinicSlotCapacity("c1", 10);

        expect(mockUpdate).toHaveBeenCalledWith({
            slotCapacity: 10,
            updatedAt: "mock-server-timestamp"
        });
        expect(result).toEqual({ clinicId: "c1", slotCapacity: 10 });
    });

    // Test: checks should throw if db update fails. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
    it("should throw if db update fails", async () => {
        db.collection.mockReturnValue({
            doc: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({ exists: true }),
                update: jest.fn().mockRejectedValue(new Error("DB write failed"))
            }))
        });

        await expect(updateClinicSlotCapacity("c1", 10))
            .rejects.toThrow("DB write failed");
    });
});
// Suite: groups related coverage for getStaffUtilisationData.
describe("getStaffUtilisationData", () => {
    const clinicId = "clinic1";
    const startDate = "2026-04-01";
    const endDate = "2026-04-02";

    const mockStaffList = [
        { uid: "staff1", fullName: "Alice", email: "alice@clinic.com", clinicId, approvalStatus: "approved" },
        { uid: "staff2", fullName: "Bob", email: "bob@clinic.com", clinicId, approvalStatus: "approved" },
    ];

    const makeUpdatedAt = (hour) => ({
        toDate: () => new Date(`2026-04-01T${String(hour).padStart(2, "0")}:00:00`)
    });

    let mockPatientsGet;
    let mockStaffAvailabilityGet;

    // Setup: resets shared mocks and test data before each case in this scope.
    beforeEach(() => {
        // Clinic doc
        const mockClinicGet = jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ clinicName: "Test Clinic" })
        });

        // Staff collection query
        const mockStaffGet = jest.fn().mockResolvedValue({
            forEach: (cb) => mockStaffList.forEach(s => cb({ data: () => s }))
        });

        // Patients subcollection (default: empty)
        mockPatientsGet = jest.fn().mockResolvedValue({
            forEach: () => {}
        });

        // Individual staff doc for availability (default: no availability)
        mockStaffAvailabilityGet = jest.fn().mockResolvedValue({
            exists: true,
            data: () => ({ Staff_Availability: {} })
        });

        db.collection.mockImplementation((collectionName) => {
            if (collectionName === "clinics") {
                return {
                    doc: jest.fn().mockReturnValue({
                        get: mockClinicGet,
                        collection: jest.fn().mockReturnValue({
                            doc: jest.fn().mockReturnValue({
                                collection: jest.fn().mockReturnValue({
                                    get: mockPatientsGet
                                })
                            })
                        })
                    })
                };
            }

            if (collectionName === "staff") {
                return {
                    where: jest.fn().mockReturnThis(),
                    get: mockStaffGet,
                    doc: jest.fn().mockReturnValue({
                        get: mockStaffAvailabilityGet
                    })
                };
            }
        });
    });

    // Test: checks should return the clinic name from Firestore. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
    it("should return the clinic name from Firestore", async () => {
        const result = await clinicService.getStaffUtilisationData(clinicId, startDate, endDate);

        expect(result.clinicName).toBe("Test Clinic");
    });

    // Test: checks should fall back to 'Clinic' if clinic doc does not exist. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
    it("should fall back to 'Clinic' if clinic doc does not exist", async () => {
        db.collection.mockImplementationOnce(() => ({
            doc: jest.fn().mockReturnValue({
                get: jest.fn().mockResolvedValue({ exists: false })
            })
        }));

        const result = await clinicService.getStaffUtilisationData(clinicId, startDate, endDate);

        expect(result.clinicName).toBe("Clinic");
    });

    // Test: checks should return the correct date range. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
    it("should return the correct date range", async () => {
        const result = await clinicService.getStaffUtilisationData(clinicId, startDate, endDate);

        expect(result.dateRange).toEqual({ startDate, endDate });
    });

    // Test: checks should return a staffList with one entry per approved staff member. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
    it("should return a staffList with one entry per approved staff member", async () => {
        const result = await clinicService.getStaffUtilisationData(clinicId, startDate, endDate);

        expect(result.staffList).toHaveLength(2);
        expect(result.staffList[0].uid).toBe("staff1");
        expect(result.staffList[1].uid).toBe("staff2");
    });

    // Test: checks should return zero totalPatients when queue is empty. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
    it("should return zero totalPatients when queue is empty", async () => {
        const result = await clinicService.getStaffUtilisationData(clinicId, startDate, endDate);

        expect(result.totalPatients).toBe(0);
    });

    // Test: checks should count patientsHandled per staff member. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
    it("should count patientsHandled per staff member", async () => {
        mockPatientsGet.mockResolvedValue({
            forEach: (cb) => [
                { updatedBy: "staff1", status: "WAITING", updatedAt: null },
                { updatedBy: "staff1", status: "WAITING", updatedAt: null },
                { updatedBy: "staff2", status: "WAITING", updatedAt: null },
            ].forEach(p => cb({ data: () => p }))
        });

        const result = await clinicService.getStaffUtilisationData(clinicId, startDate, endDate);

        const alice = result.staffList.find(s => s.uid === "staff1");
        const bob = result.staffList.find(s => s.uid === "staff2");

        expect(alice.patientsHandled).toBe(4); // 2 dates × 2 patients
        expect(bob.patientsHandled).toBe(2);   // 2 dates × 1 patient
    });

    // Test: checks should count consultationsCompleted only for COMPLETE status. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
    it("should count consultationsCompleted only for COMPLETE status", async () => {
        mockPatientsGet.mockResolvedValue({
            forEach: (cb) => [
                { updatedBy: "staff1", status: "COMPLETE", updatedAt: null },
                { updatedBy: "staff1", status: "WAITING", updatedAt: null },
            ].forEach(p => cb({ data: () => p }))
        });

        const result = await clinicService.getStaffUtilisationData(clinicId, startDate, endDate);

        const alice = result.staffList.find(s => s.uid === "staff1");

        expect(alice.consultationsCompleted).toBe(2); // 2 dates × 1 COMPLETE
    });

    // Test: checks should increment hourlyActivity at the correct hour from updatedAt. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
    it("should increment hourlyActivity at the correct hour from updatedAt", async () => {
        mockPatientsGet.mockResolvedValue({
            forEach: (cb) => [
                { updatedBy: "staff1", status: "COMPLETE", updatedAt: makeUpdatedAt(9) },
            ].forEach(p => cb({ data: () => p }))
        });

        const result = await clinicService.getStaffUtilisationData(clinicId, startDate, endDate);

        const alice = result.staffList.find(s => s.uid === "staff1");

        expect(alice.hourlyActivity[9]).toBe(2); // 2 dates × 1 patient at hour 9
        expect(alice.hourlyActivity[10]).toBe(0);
    });

    // Test: checks should skip patients with no matching staff in staffMap. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
    it("should skip patients with no matching staff in staffMap", async () => {
        mockPatientsGet.mockResolvedValue({
            forEach: (cb) => [
                { updatedBy: "unknown-staff", status: "COMPLETE", updatedAt: null },
            ].forEach(p => cb({ data: () => p }))
        });

        const result = await clinicService.getStaffUtilisationData(clinicId, startDate, endDate);

        expect(result.totalPatients).toBe(0);
    });

    // Test: checks should use addedBy if updatedBy is not present. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
    it("should use addedBy if updatedBy is not present", async () => {
        mockPatientsGet.mockResolvedValue({
            forEach: (cb) => [
                { addedBy: "staff1", status: "WAITING", updatedAt: null },
            ].forEach(p => cb({ data: () => p }))
        });

        const result = await clinicService.getStaffUtilisationData(clinicId, startDate, endDate);

        const alice = result.staffList.find(s => s.uid === "staff1");

        expect(alice.patientsHandled).toBe(2); // 2 dates × 1 patient
    });

    // Test: checks should calculate workloadShare as a percentage of totalPatients. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
    it("should calculate workloadShare as a percentage of totalPatients", async () => {
        mockPatientsGet.mockResolvedValue({
            forEach: (cb) => [
                { updatedBy: "staff1", status: "WAITING", updatedAt: null },
                { updatedBy: "staff1", status: "WAITING", updatedAt: null },
                { updatedBy: "staff1", status: "WAITING", updatedAt: null },
                { updatedBy: "staff2", status: "WAITING", updatedAt: null },
            ].forEach(p => cb({ data: () => p }))
        });

        const result = await clinicService.getStaffUtilisationData(clinicId, startDate, endDate);

        const alice = result.staffList.find(s => s.uid === "staff1");
        const bob = result.staffList.find(s => s.uid === "staff2");

        expect(alice.workloadShare).toBe(75);
        expect(bob.workloadShare).toBe(25);
    });

    // Test: checks should set workloadShare to 0 for all staff when totalPatients is 0. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
    it("should set workloadShare to 0 for all staff when totalPatients is 0", async () => {
        const result = await clinicService.getStaffUtilisationData(clinicId, startDate, endDate);

        result.staffList.forEach(s => {
            expect(s.workloadShare).toBe(0);
        });
    });

    // Test: checks should attach availability entries when staff has availability for a date. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
    it("should attach availability entries when staff has availability for a date", async () => {
        mockStaffAvailabilityGet.mockResolvedValue({
            exists: true,
            data: () => ({
                Staff_Availability: {
                    "2026-04-01": { start: "08:00", end: "16:00" },
                    "2026-04-02": { start: "09:00", end: "17:00" },
                }
            })
        });

        const result = await clinicService.getStaffUtilisationData(clinicId, startDate, endDate);

        const alice = result.staffList.find(s => s.uid === "staff1");

        expect(alice.availability).toHaveLength(2);
        expect(alice.availability[0]).toEqual({ date: "2026-04-01", start: "08:00", end: "16:00" });
        expect(alice.availability[1]).toEqual({ date: "2026-04-02", start: "09:00", end: "17:00" });
    });

    // Test: checks should leave availability empty when staff doc does not exist. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
    it("should leave availability empty when staff doc does not exist", async () => {
        mockStaffAvailabilityGet.mockResolvedValue({ exists: false });

        const result = await clinicService.getStaffUtilisationData(clinicId, startDate, endDate);

        result.staffList.forEach(s => {
            expect(s.availability).toHaveLength(0);
        });
    });
});
