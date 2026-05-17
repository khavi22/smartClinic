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

const { updateClinicSlotCapacity } = require("../services/clinicService");
const { db } = require("../services/config/firebase");

describe("updateClinicSlotCapacity", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("should throw if clinicId is 'default'", async () => {
        await expect(updateClinicSlotCapacity("default", 10))
            .rejects.toThrow("Invalid clinic ID.");
    });

    it("should throw if clinicId is empty", async () => {
        await expect(updateClinicSlotCapacity("", 10))
            .rejects.toThrow("Invalid clinic ID.");
    });

    it("should throw if slotCapacity is a float", async () => {
        await expect(updateClinicSlotCapacity("c1", 10.5))
            .rejects.toThrow("Slot capacity must be a positive integer.");
    });

    it("should throw if slotCapacity is 0", async () => {
        await expect(updateClinicSlotCapacity("c1", 0))
            .rejects.toThrow("Slot capacity must be a positive integer.");
    });

    it("should throw if slotCapacity is negative", async () => {
        await expect(updateClinicSlotCapacity("c1", -5))
            .rejects.toThrow("Slot capacity must be a positive integer.");
    });

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