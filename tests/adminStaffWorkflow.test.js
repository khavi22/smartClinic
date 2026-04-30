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
    let consoleErrorSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        if (consoleErrorSpy) consoleErrorSpy.mockRestore();
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
                user: { uid: "admin-1", email: "admin@test.com" },
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
            jest.spyOn(firebaseService, "getUserProfileById").mockResolvedValue({ fullName: "Admin Name", email: "admin@test.com" });
            jest.spyOn(emailService, "sendStaffInvitation").mockResolvedValue();

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
                .mockResolvedValueOnce({ fullName: "Admin Name", email: "admin@test.com" }); // second call for admin profile
            jest.spyOn(firebaseService, "getClinicNameById").mockResolvedValue("Test Clinic");
            jest.spyOn(emailService, "sendStaffApproval").mockResolvedValue();

            await adminController.processStaffApproval(req, res);

            expect(firebaseService.updateStaffApprovalStatus).toHaveBeenCalledWith("staff-1", "approved");
            expect(emailService.sendStaffApproval).toHaveBeenCalledWith("staff@test.com", "Test Clinic", "Admin Name", expect.any(String));
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
        });

        it("processStaffApproval handles rejection and sends email", async () => {
            req.body = { staffUid: "staff-1", status: "rejected", clinicId: "clinic-1" };
            
            jest.spyOn(firebaseService, "updateStaffApprovalStatus").mockResolvedValue();
            jest.spyOn(firebaseService, "getUserProfileById")
                .mockResolvedValueOnce({ email: "staff@test.com" }) // for staff
                .mockResolvedValueOnce({ fullName: "Admin Name", email: "admin@test.com" }); // for admin
            jest.spyOn(firebaseService, "getClinicNameById").mockResolvedValue("Test Clinic");
            jest.spyOn(emailService, "sendStaffRejection").mockResolvedValue();

            await adminController.processStaffApproval(req, res);

            expect(emailService.sendStaffRejection).toHaveBeenCalledWith("staff@test.com", "Test Clinic", "Admin Name", expect.any(String));
        });

        it("inviteStaff returns 400 when fields are missing", async () => {
            req.body = { email: "test@test.com" }; // missing clinicId
            await adminController.inviteStaff(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it("inviteStaff returns 500 on service error", async () => {
            req.body = { email: "test@test.com", clinicId: "clinic-1" };
            jest.spyOn(firebaseService, "inviteStaffByEmail").mockRejectedValue(new Error("Firebase Fail"));
            await adminController.inviteStaff(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });

        describe("getPendingStaff", () => {
            it("returns pending staff for a clinic", async () => {
                req.query = { clinicId: "clinic-1" };
                const mockStaff = [{ uid: "s1", fullName: "Staff One" }];
                jest.spyOn(firebaseService, "getPendingStaffByClinic").mockResolvedValue(mockStaff);

                await adminController.getPendingStaff(req, res);

                expect(res.json).toHaveBeenCalledWith({ success: true, staff: mockStaff });
            });

            it("returns 400 when clinicId is missing", async () => {
                req.query = {};
                await adminController.getPendingStaff(req, res);
                expect(res.status).toHaveBeenCalledWith(400);
            });

            it("returns 500 on service error", async () => {
                req.query = { clinicId: "clinic-1" };
                jest.spyOn(firebaseService, "getPendingStaffByClinic").mockRejectedValue(new Error("Fail"));
                await adminController.getPendingStaff(req, res);
                expect(res.status).toHaveBeenCalledWith(500);
            });
        });

        describe("getActiveStaff", () => {
            it("returns active staff for a clinic", async () => {
                req.query = { clinicId: "clinic-1" };
                const mockStaff = [{ uid: "s1", fullName: "Staff One", approvalStatus: "approved" }];
                jest.spyOn(firebaseService, "getActiveStaffByClinic").mockResolvedValue(mockStaff);

                await adminController.getActiveStaff(req, res);

                expect(res.json).toHaveBeenCalledWith({ success: true, staff: mockStaff });
            });

            it("returns 400 when clinicId is missing", async () => {
                req.query = {};
                await adminController.getActiveStaff(req, res);
                expect(res.status).toHaveBeenCalledWith(400);
            });

            it("returns 500 on service error", async () => {
                req.query = { clinicId: "clinic-1" };
                jest.spyOn(firebaseService, "getActiveStaffByClinic").mockRejectedValueOnce(new Error("Fail"));
                await adminController.getActiveStaff(req, res);
                expect(res.status).toHaveBeenCalledWith(500);
            });
        });

        describe("removeStaff", () => {
            it("removes a staff member successfully", async () => {
                req.body = { staffUid: "s1", clinicId: "c1" };
                jest.spyOn(firebaseService, "removeStaffFromClinic").mockResolvedValueOnce();

                await adminController.removeStaff(req, res);

                expect(firebaseService.removeStaffFromClinic).toHaveBeenCalledWith("s1");
                expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
            });

            it("returns 400 when fields are missing", async () => {
                req.body = { staffUid: "s1" };
                await adminController.removeStaff(req, res);
                expect(res.status).toHaveBeenCalledWith(400);
            });

            it("returns 500 on service error", async () => {
                req.body = { staffUid: "s1", clinicId: "c1" };
                jest.spyOn(firebaseService, "removeStaffFromClinic").mockRejectedValueOnce(new Error("Fail"));
                await adminController.removeStaff(req, res);
                expect(res.status).toHaveBeenCalledWith(500);
            });
        });

        it("processStaffApproval returns 400 for missing fields", async () => {
            req.body = { staffUid: "s1" }; // missing status/clinicId
            await adminController.processStaffApproval(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it("processStaffApproval returns 400 for invalid status", async () => {
            req.body = { staffUid: "s1", status: "invalid", clinicId: "c1" };
            await adminController.processStaffApproval(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it("processStaffApproval returns 404 if staff profile is missing", async () => {
            req.body = { staffUid: "s1", status: "approved", clinicId: "c1" };
            jest.spyOn(firebaseService, "updateStaffApprovalStatus").mockResolvedValueOnce();
            jest.spyOn(firebaseService, "getUserProfileById").mockResolvedValueOnce(null);
            
            await adminController.processStaffApproval(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        it("processStaffApproval returns 500 on service error", async () => {
            req.body = { staffUid: "s1", status: "approved", clinicId: "c1" };
            jest.spyOn(firebaseService, "updateStaffApprovalStatus").mockRejectedValueOnce(new Error("Fail"));
            
            await adminController.processStaffApproval(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe("additional firebaseService staff methods", () => {
        it("getActiveStaffByClinic returns list of approved staff", async () => {
            const mockSnapshot = {
                forEach: (cb) => {
                    cb({ id: "s1", data: () => ({ fullName: "Staff One", approvalStatus: "approved" }) });
                }
            };
            const query = {
                where: jest.fn().mockReturnThis(),
                get: jest.fn().mockResolvedValue(mockSnapshot)
            };
            db.collection.mockReturnValue(query);

            const result = await firebaseService.getActiveStaffByClinic("clinic-1");

            expect(result).toHaveLength(1);
            expect(result[0].uid).toBe("s1");
        });

        it("removeStaffFromClinic updates status to removed", async () => {
            const update = jest.fn().mockResolvedValue();
            db.collection.mockReturnValue({
                doc: jest.fn(() => ({ update }))
            });

            await firebaseService.removeStaffFromClinic("staff-1");

            expect(update).toHaveBeenCalledWith(expect.objectContaining({
                approvalStatus: "removed",
                clinicId: null
            }));
        });
    });
});
