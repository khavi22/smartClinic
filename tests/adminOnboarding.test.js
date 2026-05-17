/**
 * Admin Onboarding Controller Tests
 * Tests for clinic search and admin invitation flow
 */

const {
    searchClinics,
    getClinicCode,
    sendAdminInvite,
    getInvitationStatus
} = require("../Controllers/AdminOnboardingController");
const clinicService = require("../services/clinicService");
const emailService = require("../services/emailService");
const { db, admin } = require("../services/config/firebase");

jest.mock("../services/clinicService");
jest.mock("../services/emailService");
jest.mock("../services/config/firebase");

describe("AdminOnboardingController", () => {
    let req, res;

    beforeEach(() => {
        req = {
            body: {},
            params: {},
            headers: {},
            query: {}
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            send: jest.fn()
        };
        jest.clearAllMocks();
        jest.spyOn(console, "log").mockImplementation(() => {});
        jest.spyOn(console, "error").mockImplementation(() => {});
    });

    describe("searchClinics", () => {
        it("should return 400 if query is missing", async () => {
            req.body = {};
            await searchClinics(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: expect.stringContaining("Query is required")
                })
            );
        });

        it("should return 400 if query is not a string", async () => {
            req.body = { query: 123 };
            await searchClinics(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: expect.stringContaining("Query is required")
                })
            );
        });

        it("should return 400 if query is empty string", async () => {
            req.body = { query: "   " };
            await searchClinics(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it("should return empty array if no clinics found", async () => {
            req.body = { query: "Nonexistent Clinic" };
            clinicService.searchClinics.mockResolvedValue([]);

            await searchClinics(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                places: [],
                count: 0
            });
        });

        it("should return clinics when search is successful", async () => {
            req.body = { query: "Smart Hospital" };
            const mockClinics = [
                {
                    id: "place-123",
                    displayName: { text: "Smart Hospital Downtown" },
                    formattedAddress: "123 Main St, City, Country"
                },
                {
                    id: "place-456",
                    displayName: { text: "Smart Hospital Uptown" },
                    formattedAddress: "456 Oak Ave, City, Country"
                }
            ];

            clinicService.searchClinics.mockResolvedValue(mockClinics);

            await searchClinics(req, res);

            expect(clinicService.searchClinics).toHaveBeenCalledWith("clinic named Smart Hospital");
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                places: mockClinics,
                count: 2
            });
        });

        it("should handle search service errors", async () => {
            req.body = { query: "Test Clinic" };
            clinicService.searchClinics.mockRejectedValue(new Error("API error"));

            await searchClinics(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: expect.stringContaining("Failed to search clinics")
                })
            );
        });
    });

    describe("getClinicCode", () => {
        it("should return 400 if placeId is missing", async () => {
            req.body = {};
            await getClinicCode(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Place ID is required"
            });
        });

        it("should return existing admin code if clinic exists", async () => {
            req.body = { placeId: "place-123" };
            const existingAdminCode = "ADM-ABC123";

            db.collection.mockReturnValue({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({
                        exists: true,
                        data: () => ({ adminCode: existingAdminCode })
                    })
                }))
            });

            await getClinicCode(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                clinicId: "place-123",
                adminCode: existingAdminCode
            });
        });

        it("should create new clinic with admin code if clinic does not exist", async () => {
            req.body = { placeId: "place-new" };

            const mockSet = jest.fn().mockResolvedValue(undefined);
            db.collection.mockReturnValue({
                doc: jest.fn((docId) => ({
                    get: jest.fn().mockResolvedValue({ exists: false }),
                    set: mockSet
                }))
            });

            admin.firestore.FieldValue.serverTimestamp.mockReturnValue("timestamp");

            await getClinicCode(req, res);

            expect(mockSet).toHaveBeenCalled();
            const setCall = mockSet.mock.calls[0][0];
            expect(setCall).toHaveProperty("placeId", "place-new");
            expect(setCall).toHaveProperty("adminCode");
            expect(setCall.adminCode).toMatch(/^ADM-[A-Z0-9]{6}$/);

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    clinicId: "place-new"
                })
            );
        });

        it("should handle database errors", async () => {
            req.body = { placeId: "place-123" };

            db.collection.mockReturnValue({
                doc: jest.fn(() => ({
                    get: jest.fn().mockRejectedValue(new Error("DB error"))
                }))
            });

            await getClinicCode(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: expect.stringContaining("Failed to get clinic code")
                })
            );
        });
    });

    describe("sendAdminInvite", () => {
        const validPayload = {
            adminEmail: "admin@clinic.com",
            clinicId: "place-123",
            clinicName: "Smart Hospital",
            clinicAddress: "123 Main St, City",
            adminCode: "ADM-ABC123"
        };

        it("should return 400 if adminEmail is missing", async () => {
            req.body = { ...validPayload, adminEmail: undefined };
            await sendAdminInvite(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    errors: expect.arrayContaining([expect.stringContaining("email")])
                })
            );
        });

        it("should return 400 if adminEmail is invalid format", async () => {
            req.body = { ...validPayload, adminEmail: "invalid-email" };
            await sendAdminInvite(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it("should return 400 if clinicId is missing", async () => {
            req.body = { ...validPayload, clinicId: undefined };
            await sendAdminInvite(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it("should return 400 if adminCode is missing", async () => {
            req.body = { ...validPayload, adminCode: undefined };
            await sendAdminInvite(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it("should return 409 if clinic already has an admin", async () => {
            req.body = validPayload;

            db.collection.mockReturnValue({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({
                        exists: true,
                        data: () => ({ adminUid: "existing-admin-uid" })
                    })
                }))
            });

            await sendAdminInvite(req, res);

            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: expect.stringContaining("already has an assigned administrator")
            });
        });

        it("should successfully send admin invitation", async () => {
            req.body = validPayload;

            const mockUpdate = jest.fn().mockResolvedValue(undefined);
            const mockAdd = jest.fn().mockResolvedValue({ id: "inv-123" });
            const mockGet = jest.fn().mockResolvedValue({
                exists: true,
                data: () => ({ adminUid: null })  // No existing admin
            });

            db.collection.mockReturnValue({
                doc: jest.fn(() => ({
                    get: mockGet,
                    update: mockUpdate
                })),
                add: mockAdd
            });

            emailService.sendAdminInvitation.mockResolvedValue({ messageId: "msg-123" });

            await sendAdminInvite(req, res);

            expect(mockGet).toHaveBeenCalled();
            expect(mockUpdate).toHaveBeenCalled();
            expect(emailService.sendAdminInvitation).toHaveBeenCalledWith(
                "admin@clinic.com",
                expect.stringContaining("Smart Hospital"),
                expect.stringContaining("ADM-ABC123")
            );
            expect(mockAdd).toHaveBeenCalled();

            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: true,
                    message: expect.stringContaining("admin@clinic.com"),
                    clinicId: "place-123"
                })
            );
        });

        it("should normalize email to lowercase", async () => {
            req.body = { ...validPayload, adminEmail: "Admin@Clinic.COM" };

            const mockUpdate = jest.fn().mockResolvedValue(undefined);
            const mockAdd = jest.fn().mockResolvedValue({ id: "inv-123" });

            db.collection.mockReturnValue({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({
                        exists: true,
                        data: () => ({ adminUid: null })
                    }),
                    update: mockUpdate
                })),
                add: mockAdd
            });

            emailService.sendAdminInvitation.mockResolvedValue({ messageId: "msg-123" });

            await sendAdminInvite(req, res);

            const addCall = mockAdd.mock.calls[0][0];
            expect(addCall.adminEmail).toBe("admin@clinic.com");
        });

        it("should include support notes if provided", async () => {
            req.body = {
                ...validPayload,
                supportNotes: "This is a test clinic from demo account"
            };

            const mockUpdate = jest.fn().mockResolvedValue(undefined);
            const mockAdd = jest.fn().mockResolvedValue({ id: "inv-123" });

            db.collection.mockReturnValue({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({
                        exists: true,
                        data: () => ({ adminUid: null })
                    }),
                    update: mockUpdate
                })),
                add: mockAdd
            });

            emailService.sendAdminInvitation.mockResolvedValue({ messageId: "msg-123" });

            await sendAdminInvite(req, res);

            const addCall = mockAdd.mock.calls[0][0];
            expect(addCall.supportNotes).toBe("This is a test clinic from demo account");
        });

        it("should handle email sending errors", async () => {
            req.body = validPayload;

            db.collection.mockReturnValue({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({
                        exists: true,
                        data: () => ({ adminUid: null })
                    }),
                    update: jest.fn().mockResolvedValue(undefined)
                }))
            });

            emailService.sendAdminInvitation.mockRejectedValue(new Error("Email service down"));

            await sendAdminInvite(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: expect.stringContaining("Failed to send invitation")
                })
            );
        });

        it("should handle database update errors", async () => {
            req.body = validPayload;

            db.collection.mockReturnValue({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({
                        exists: true,
                        data: () => ({ adminUid: null })
                    }),
                    update: jest.fn().mockRejectedValue(new Error("DB update failed"))
                }))
            });

            await sendAdminInvite(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
        });
    });

    describe("getInvitationStatus", () => {
        it("should return 400 if clinicId is missing", async () => {
            req.params = {};
            await getInvitationStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                success: false,
                message: "Clinic ID is required"
            });
        });

        it("should return null invitation if none found", async () => {
            req.params = { clinicId: "place-123" };

            db.collection.mockReturnValue({
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                get: jest.fn().mockResolvedValue({
                    empty: true,
                    docs: []
                })
            });

            await getInvitationStatus(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                invitation: null,
                message: "No invitation found for this clinic"
            });
        });

        it("should return most recent invitation", async () => {
            req.params = { clinicId: "place-123" };

            const mockInvitation = {
                clinicId: "place-123",
                adminEmail: "admin@clinic.com",
                adminName: "Dr. Smith",
                status: "pending",
                sentAt: new Date()
            };

            db.collection.mockReturnValue({
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                get: jest.fn().mockResolvedValue({
                    empty: false,
                    docs: [
                        {
                            id: "inv-123",
                            data: () => mockInvitation
                        }
                    ]
                })
            });

            await getInvitationStatus(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                invitation: expect.objectContaining({
                    ...mockInvitation,
                    invitationId: "inv-123"
                })
            });
        });

        it("should handle database errors", async () => {
            req.params = { clinicId: "place-123" };

            db.collection.mockReturnValue({
                where: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                get: jest.fn().mockRejectedValue(new Error("DB query failed"))
            });

            await getInvitationStatus(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: expect.stringContaining("Failed to get invitation status")
                })
            );
        });
    });

    describe("Email HTML Content", () => {
        it("should send invitation email with clinic details", async () => {
            req.body = {
                adminEmail: "admin@clinic.com",
                adminName: "Dr. John Smith",
                clinicId: "place-123",
                clinicName: "Smart Hospital",
                clinicAddress: "123 Main St, City",
                adminCode: "ADM-ABC123"
            };

            const mockUpdate = jest.fn().mockResolvedValue(undefined);
            const mockAdd = jest.fn().mockResolvedValue({ id: "inv-123" });

            db.collection.mockReturnValue({
                doc: jest.fn(() => ({
                    get: jest.fn().mockResolvedValue({
                        exists: true,
                        data: () => ({ adminUid: null })
                    }),
                    update: mockUpdate
                })),
                add: mockAdd
            });

            emailService.sendAdminInvitation.mockResolvedValue({ messageId: "msg-123" });

            await sendAdminInvite(req, res);

            const emailCall = emailService.sendAdminInvitation.mock.calls[0];
            const emailHtml = emailCall[2];

            expect(emailHtml).toContain("Dr. John Smith");
            expect(emailHtml).toContain("Smart Hospital");
            expect(emailHtml).toContain("ADM-ABC123");
            expect(emailHtml).toContain("123 Main St, City");
        });
    });
});
