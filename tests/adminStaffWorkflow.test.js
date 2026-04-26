const mockServerTimestamp = jest.fn(() => "mock-server-timestamp");

jest.mock("../services/config/firebase", () => ({
    db: {
        collection: jest.fn()
    },
    admin: {
        firestore: {
            FieldValue: {
                serverTimestamp: mockServerTimestamp
            }
        }
    }
}));

jest.mock("../services/emailService", () => ({
    sendStaffInvitation: jest.fn().mockResolvedValue(),
    sendStaffApproval: jest.fn().mockResolvedValue(),
    sendStaffRejection: jest.fn().mockResolvedValue()
}));

const firebaseService = require("../services/firebaseService");
const adminController = require("../Controllers/AdminController");
const emailService = require("../services/emailService");
const { db } = require("../services/config/firebase");

describe("Admin Staff Workflow Tests", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("firebaseService staff methods", () => {
        it("inviteStaffByEmail stores a pending invitation", async () => {
            const set = jest.fn().mockResolvedValue();
            const get = jest.fn().mockResolvedValue({ exists: false });
            db.collection.mockReturnValue({
                doc: jest.fn(() => ({ get, set }))
            });

            await firebaseService.inviteStaffByEmail("admin-1", "clinic-1", "staff@example.com");

            expect(db.collection).toHaveBeenCalledWith("clinicInvites");
            expect(set).toHaveBeenCalledWith(expect.objectContaining({
                email: "staff@example.com",
                clinicId: "clinic-1",
                invitedBy: "admin-1",
                status: "pending"
            }));
        });

        it("inviteStaffByEmail throws error if email already invited", async () => {
            const get = jest.fn().mockResolvedValue({ exists: true });
            db.collection.mockReturnValue({
                doc: jest.fn(() => ({ get }))
            });

            await expect(
                firebaseService.inviteStaffByEmail("admin-1", "clinic-1", "staff@example.com")
            ).rejects.toThrow("This email has already been invited.");
        });

        it("updateStaffApprovalStatus updates the status field", async () => {
            const update = jest.fn().mockResolvedValue();
            db.collection.mockReturnValue({
                doc: jest.fn(() => ({ update }))
            });

            await firebaseService.updateStaffApprovalStatus("staff-1", "approved");

            expect(db.collection).toHaveBeenCalledWith("staff");
            expect(update).toHaveBeenCalledWith(expect.objectContaining({
                approvalStatus: "approved"
            }));
        });

        it("getPendingStaffByClinic returns list of pending staff", async () => {
            const mockSnapshot = {
                forEach: (cb) => {
                    cb({ id: "s1", data: () => ({ fullName: "Staff One", approvalStatus: "pending" }) });
                }
            };
            const query = {
                where: jest.fn().mockReturnThis(),
                get: jest.fn().mockResolvedValue(mockSnapshot)
            };
            db.collection.mockReturnValue(query);

            const result = await firebaseService.getPendingStaffByClinic("clinic-1");

            expect(result).toHaveLength(1);
            expect(result[0].fullName).toBe("Staff One");
        });
    });

    describe("AdminController logic", () => {
        let req, res;

        beforeEach(() => {
            req = {
                user: { uid: "admin-1" },
                body: {},
                query: {}
            };
            res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis()
            };
        });

        it("inviteStaff sends an invitation email and creates record", async () => {
            req.body = { email: "staff@test.com", clinicId: "clinic-1" };
            
            // Mock firebaseService calls within controller
            jest.spyOn(firebaseService, "inviteStaffByEmail").mockResolvedValue();
            jest.spyOn(firebaseService, "getClinicNameById").mockResolvedValue("Test Clinic");
            jest.spyOn(firebaseService, "getUserProfileById").mockResolvedValue({ fullName: "Admin Name" });

            await adminController.inviteStaff(req, res);

            expect(firebaseService.inviteStaffByEmail).toHaveBeenCalledWith("admin-1", "clinic-1", "staff@test.com");
            expect(emailService.sendStaffInvitation).toHaveBeenCalledWith("staff@test.com", "Test Clinic", "Admin Name", expect.any(String));
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        });

        it("processStaffApproval handles approval and sends email", async () => {
            req.body = { staffUid: "staff-1", status: "approved", clinicId: "clinic-1" };
            
            jest.spyOn(firebaseService, "updateStaffApprovalStatus").mockResolvedValue();
            jest.spyOn(firebaseService, "getUserProfileById")
                .mockResolvedValueOnce({ email: "staff@test.com" }) // first call for staff profile
                .mockResolvedValueOnce({ fullName: "Admin Name" }); // second call for admin profile
            jest.spyOn(firebaseService, "getClinicNameById").mockResolvedValue("Test Clinic");

            await adminController.processStaffApproval(req, res);

            expect(firebaseService.updateStaffApprovalStatus).toHaveBeenCalledWith("staff-1", "approved");
            expect(emailService.sendStaffApproval).toHaveBeenCalledWith("staff@test.com", "Test Clinic", "Admin Name", expect.any(String));
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        });

        it("processStaffApproval handles rejection and sends email", async () => {
            req.body = { staffUid: "staff-1", status: "rejected", clinicId: "clinic-1" };
            
            jest.spyOn(firebaseService, "updateStaffApprovalStatus").mockResolvedValue();
            jest.spyOn(firebaseService, "getUserProfileById")
                .mockResolvedValueOnce({ email: "staff@test.com" })
                .mockResolvedValueOnce({ fullName: "Admin Name" });
            jest.spyOn(firebaseService, "getClinicNameById").mockResolvedValue("Test Clinic");

            await adminController.processStaffApproval(req, res);

            expect(emailService.sendStaffRejection).toHaveBeenCalledWith("staff@test.com", "Test Clinic", "Admin Name", expect.any(String));
        });
    });
});
