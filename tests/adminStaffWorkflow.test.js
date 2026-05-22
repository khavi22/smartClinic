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

// Suite: groups related coverage for Admin Staff Workflow Tests.
describe("Admin Staff Workflow Tests", () => {
    let consoleErrorSpy;

    // Setup: resets shared mocks and test data before each case in this scope.
    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    // Cleanup: restores mocks so one test cannot leak state into the next.
    afterEach(() => {
        if (consoleErrorSpy) consoleErrorSpy.mockRestore();
    });

    // Suite: groups related coverage for firebaseService staff methods.
    describe("firebaseService staff methods", () => {
        // Test: checks inviteStaffByEmail stores a pending invitation. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks inviteStaffByEmail throws error if email already invited. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("inviteStaffByEmail throws error if email already invited", async () => {
            const get = jest.fn().mockResolvedValue({ exists: true });
            db.collection.mockReturnValue({
                doc: jest.fn(() => ({ get }))
            });

            await expect(
                firebaseService.inviteStaffByEmail("admin-1", "clinic-1", "staff@example.com")
            ).rejects.toThrow("This email has already been invited.");
        });

        // Test: checks updateStaffApprovalStatus updates the status field. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks getPendingStaffByClinic returns list of pending staff. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

    // Suite: groups related coverage for AdminController logic.
    describe("AdminController logic", () => {
        let req, res;

        // Setup: resets shared mocks and test data before each case in this scope.
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

        // Suite: groups related coverage for report endpoints.
        describe("report endpoints", () => {
            // Test: checks returns wait-time report data. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
            it("returns wait-time report data", async () => {
                req.query = {
                    clinicId: "clinic-1",
                    startDate: "2026-05-01",
                    endDate: "2026-05-31"
                };
                const report = { totalCompleted: 2 };
                jest.spyOn(firebaseService, "getWaitTimeReport").mockResolvedValue(report);

                await adminController.getWaitTimeReport(req, res);

                expect(firebaseService.getWaitTimeReport).toHaveBeenCalledWith(
                    "clinic-1",
                    "2026-05-01",
                    "2026-05-31"
                );
                expect(res.status).toHaveBeenCalledWith(200);
                expect(res.json).toHaveBeenCalledWith({ success: true, report });
            });

            // Test: checks validates required wait-time report query params. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
            it("validates required wait-time report query params", async () => {
                req.query = {
                    clinicId: "clinic-1",
                    startDate: "2026-05-01"
                };

                await adminController.getWaitTimeReport(req, res);

                expect(res.status).toHaveBeenCalledWith(400);
            });

            // Test: checks validates wait-time report date format. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
            it("validates wait-time report date format", async () => {
                req.query = {
                    clinicId: "clinic-1",
                    startDate: "05/01/2026",
                    endDate: "2026-05-31"
                };

                await adminController.getWaitTimeReport(req, res);

                expect(res.status).toHaveBeenCalledWith(400);
            });

            // Test: checks validates wait-time report date order. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
            it("validates wait-time report date order", async () => {
                req.query = {
                    clinicId: "clinic-1",
                    startDate: "2026-06-01",
                    endDate: "2026-05-31"
                };

                await adminController.getWaitTimeReport(req, res);

                expect(res.status).toHaveBeenCalledWith(400);
            });

            // Test: checks returns 500 when wait-time report generation fails. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
            it("returns 500 when wait-time report generation fails", async () => {
                req.query = {
                    clinicId: "clinic-1",
                    startDate: "2026-05-01",
                    endDate: "2026-05-31"
                };
                jest.spyOn(firebaseService, "getWaitTimeReport")
                    .mockRejectedValue(new Error("Report failed"));

                await adminController.getWaitTimeReport(req, res);

                expect(res.status).toHaveBeenCalledWith(500);
            });

            // Test: checks returns no-show report data. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
            it("returns no-show report data", async () => {
                req.query = {
                    clinicId: "clinic-1",
                    startDate: "2026-05-01",
                    endDate: "2026-05-31"
                };
                const report = { totalNoShows: 1 };
                jest.spyOn(firebaseService, "getNoShowReport").mockResolvedValue(report);

                await adminController.getNoShowReport(req, res);

                expect(firebaseService.getNoShowReport).toHaveBeenCalledWith(
                    "clinic-1",
                    "2026-05-01",
                    "2026-05-31"
                );
                expect(res.status).toHaveBeenCalledWith(200);
                expect(res.json).toHaveBeenCalledWith({ success: true, report });
            });

            // Test: checks validates required no-show report query params. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
            it("validates required no-show report query params", async () => {
                req.query = {
                    clinicId: "clinic-1",
                    endDate: "2026-05-31"
                };

                await adminController.getNoShowReport(req, res);

                expect(res.status).toHaveBeenCalledWith(400);
            });

            // Test: checks validates no-show report date format. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
            it("validates no-show report date format", async () => {
                req.query = {
                    clinicId: "clinic-1",
                    startDate: "2026-05-01",
                    endDate: "31-05-2026"
                };

                await adminController.getNoShowReport(req, res);

                expect(res.status).toHaveBeenCalledWith(400);
            });

            // Test: checks validates no-show report date order. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
            it("validates no-show report date order", async () => {
                req.query = {
                    clinicId: "clinic-1",
                    startDate: "2026-06-01",
                    endDate: "2026-05-31"
                };

                await adminController.getNoShowReport(req, res);

                expect(res.status).toHaveBeenCalledWith(400);
            });

            // Test: checks returns 500 when no-show report generation fails. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
            it("returns 500 when no-show report generation fails", async () => {
                req.query = {
                    clinicId: "clinic-1",
                    startDate: "2026-05-01",
                    endDate: "2026-05-31"
                };
                jest.spyOn(firebaseService, "getNoShowReport")
                    .mockRejectedValue(new Error("Report failed"));

                await adminController.getNoShowReport(req, res);

                expect(res.status).toHaveBeenCalledWith(500);
            });
        });

        // Test: checks inviteStaff sends an invitation email and creates record. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks processStaffApproval handles approval and sends email. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks processStaffApproval handles rejection and sends email. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks inviteStaff returns 400 when fields are missing. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("inviteStaff returns 400 when fields are missing", async () => {
            req.body = { email: "test@test.com" }; // missing clinicId
            await adminController.inviteStaff(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        // Test: checks inviteStaff returns 500 on service error. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("inviteStaff returns 500 on service error", async () => {
            req.body = { email: "test@test.com", clinicId: "clinic-1" };
            jest.spyOn(firebaseService, "inviteStaffByEmail").mockRejectedValue(new Error("Firebase Fail"));
            await adminController.inviteStaff(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });

        // Suite: groups related coverage for getPendingStaff.
        describe("getPendingStaff", () => {
            // Test: checks returns pending staff for a clinic. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
            it("returns pending staff for a clinic", async () => {
                req.query = { clinicId: "clinic-1" };
                const mockStaff = [{ uid: "s1", fullName: "Staff One" }];
                jest.spyOn(firebaseService, "getPendingStaffByClinic").mockResolvedValue(mockStaff);

                await adminController.getPendingStaff(req, res);

                expect(res.json).toHaveBeenCalledWith({ success: true, staff: mockStaff });
            });

            // Test: checks returns 400 when clinicId is missing. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
            it("returns 400 when clinicId is missing", async () => {
                req.query = {};
                await adminController.getPendingStaff(req, res);
                expect(res.status).toHaveBeenCalledWith(400);
            });

            // Test: checks returns 500 on service error. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
            it("returns 500 on service error", async () => {
                req.query = { clinicId: "clinic-1" };
                jest.spyOn(firebaseService, "getPendingStaffByClinic").mockRejectedValue(new Error("Fail"));
                await adminController.getPendingStaff(req, res);
                expect(res.status).toHaveBeenCalledWith(500);
            });
        });

        // Suite: groups related coverage for getActiveStaff.
        describe("getActiveStaff", () => {
            // Test: checks returns active staff for a clinic. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
            it("returns active staff for a clinic", async () => {
                req.query = { clinicId: "clinic-1" };
                const mockStaff = [{ uid: "s1", fullName: "Staff One", approvalStatus: "approved" }];
                jest.spyOn(firebaseService, "getActiveStaffByClinic").mockResolvedValue(mockStaff);

                await adminController.getActiveStaff(req, res);

                expect(res.json).toHaveBeenCalledWith({ success: true, staff: mockStaff });
            });

            // Test: checks returns 400 when clinicId is missing. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
            it("returns 400 when clinicId is missing", async () => {
                req.query = {};
                await adminController.getActiveStaff(req, res);
                expect(res.status).toHaveBeenCalledWith(400);
            });

            // Test: checks returns 500 on service error. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
            it("returns 500 on service error", async () => {
                req.query = { clinicId: "clinic-1" };
                jest.spyOn(firebaseService, "getActiveStaffByClinic").mockRejectedValueOnce(new Error("Fail"));
                await adminController.getActiveStaff(req, res);
                expect(res.status).toHaveBeenCalledWith(500);
            });
        });

        // Suite: groups related coverage for removeStaff.
        describe("removeStaff", () => {
            // Test: checks removes a staff member successfully after validation. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
            it("removes a staff member successfully after validation", async () => {
                req.body = { staffUid: "s1" };
                const adminProfile = { uid: "admin-1", clinicId: "clinic-1", role: "admin" };
                const staffProfile = { uid: "s1", clinicId: "clinic-1", role: "staff" };

                jest.spyOn(firebaseService, "getUserProfileById")
                    .mockResolvedValueOnce(staffProfile)
                    .mockResolvedValueOnce(adminProfile);
                jest.spyOn(firebaseService, "deleteUserAccount").mockResolvedValueOnce();

                await adminController.removeStaff(req, res);

                expect(firebaseService.deleteUserAccount).toHaveBeenCalledWith("s1");
                expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
                    success: true,
                    message: expect.stringContaining("deleted successfully")
                }));
            });

            // Test: checks returns 403 if staff belongs to another clinic. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
            it("returns 403 if staff belongs to another clinic", async () => {
                req.body = { staffUid: "s1" };
                const adminProfile = { uid: "admin-1", clinicId: "clinic-1", role: "admin" };
                const staffProfile = { uid: "s1", clinicId: "clinic-OTHER", role: "staff" };

                jest.spyOn(firebaseService, "getUserProfileById")
                    .mockResolvedValueOnce(staffProfile)
                    .mockResolvedValueOnce(adminProfile);

                await adminController.removeStaff(req, res);

                expect(res.status).toHaveBeenCalledWith(403);
                expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                    message: expect.stringContaining("permission")
                }));
            });

            // Test: checks returns 404 if staff member doesn't exist. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
            it("returns 404 if staff member doesn't exist", async () => {
                req.body = { staffUid: "s1" };
                jest.spyOn(firebaseService, "getUserProfileById").mockResolvedValueOnce(null);

                await adminController.removeStaff(req, res);

                expect(res.status).toHaveBeenCalledWith(404);
            });

            // Test: checks returns 500 on service error. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
            it("returns 500 on service error", async () => {
                req.body = { staffUid: "s1" };
                jest.spyOn(firebaseService, "getUserProfileById").mockRejectedValueOnce(new Error("Fail"));
                
                await adminController.removeStaff(req, res);
                expect(res.status).toHaveBeenCalledWith(500);
            });
        });

        // Test: checks processStaffApproval returns 400 for missing fields. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("processStaffApproval returns 400 for missing fields", async () => {
            req.body = { staffUid: "s1" }; // missing status/clinicId
            await adminController.processStaffApproval(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        // Test: checks processStaffApproval returns 400 for invalid status. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("processStaffApproval returns 400 for invalid status", async () => {
            req.body = { staffUid: "s1", status: "invalid", clinicId: "c1" };
            await adminController.processStaffApproval(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        // Test: checks processStaffApproval returns 404 if staff profile is missing. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("processStaffApproval returns 404 if staff profile is missing", async () => {
            req.body = { staffUid: "s1", status: "approved", clinicId: "c1" };
            jest.spyOn(firebaseService, "updateStaffApprovalStatus").mockResolvedValueOnce();
            jest.spyOn(firebaseService, "getUserProfileById").mockResolvedValueOnce(null);
            
            await adminController.processStaffApproval(req, res);
            expect(res.status).toHaveBeenCalledWith(404);
        });

        // Test: checks processStaffApproval returns 500 on service error. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
        it("processStaffApproval returns 500 on service error", async () => {
            req.body = { staffUid: "s1", status: "approved", clinicId: "c1" };
            jest.spyOn(firebaseService, "updateStaffApprovalStatus").mockRejectedValueOnce(new Error("Fail"));
            
            await adminController.processStaffApproval(req, res);
            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    // Suite: groups related coverage for additional firebaseService staff methods.
    describe("additional firebaseService staff methods", () => {
        // Test: checks getActiveStaffByClinic returns list of approved staff. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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

        // Test: checks removeStaffFromClinic updates status to removed. How: it arranges mocks or request data, runs the target code, and asserts the expected result.
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
