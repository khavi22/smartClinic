const mockSendMail = jest.fn();

const nodemailer = require("nodemailer");

jest.mock("nodemailer", () => ({
    createTransport: jest.fn(() => ({
        sendMail: mockSendMail,
    })),
}));

process.env.SMTP_HOST = "smtp.test.com";
process.env.SMTP_PORT = "587";
process.env.SMTP_USER = "test@test.com";
process.env.SMTP_PASS = "password";
process.env.BASE_URL = "http://localhost:3000";

const emailService = require("../services/emailService");

describe("Email Service", () => {

    beforeEach(() => {

        jest.clearAllMocks();

        mockSendMail.mockResolvedValue({
            messageId: "message-123",
        });
    });

    // =====================================================
    // sendEmail
    // =====================================================

    describe("sendEmail", () => {

        it("should send an email successfully", async () => {

            const result = await emailService.sendEmail(
                "patient@test.com",
                "Test Subject",
                "<p>Hello</p>"
            );

            expect(mockSendMail)
                .toHaveBeenCalledTimes(1);

            expect(mockSendMail)
                .toHaveBeenCalledWith(
                    expect.objectContaining({
                        to: "patient@test.com",
                        subject: "Test Subject",
                    })
                );

            expect(result.messageId)
                .toBe("message-123");
        });

        it("should throw error if sendMail fails", async () => {

            mockSendMail.mockRejectedValue(
                new Error("SMTP Error")
            );

            await expect(
                emailService.sendEmail(
                    "patient@test.com",
                    "Subject",
                    "<p>Hello</p>"
                )
            ).rejects.toThrow("SMTP Error");
        });
    });

    // =====================================================
    // sendStaffInvitation
    // =====================================================

    describe("sendStaffInvitation", () => {

        it("should send staff invitation email", async () => {

            await emailService.sendStaffInvitation(
                "staff@test.com",
                "Clinic A",
                "Admin User",
                "admin@test.com"
            );

            expect(mockSendMail)
                .toHaveBeenCalledTimes(1);

            expect(mockSendMail)
                .toHaveBeenCalledWith(
                    expect.objectContaining({
                        to: "staff@test.com",
                    })
                );
        });
    });

    // =====================================================
    // sendStaffApproval
    // =====================================================

    describe("sendStaffApproval", () => {

        it("should send approval email", async () => {

            await emailService.sendStaffApproval(
                "staff@test.com",
                "Clinic A",
                "Admin User",
                "admin@test.com"
            );

            expect(mockSendMail)
                .toHaveBeenCalledTimes(1);

            expect(mockSendMail)
                .toHaveBeenCalledWith(
                    expect.objectContaining({
                        to: "staff@test.com",
                    })
                );
        });
    });

    // =====================================================
    // sendStaffRejection
    // =====================================================

    describe("sendStaffRejection", () => {

        it("should send rejection email", async () => {

            await emailService.sendStaffRejection(
                "staff@test.com",
                "Clinic A",
                "Admin User",
                "admin@test.com"
            );

            expect(mockSendMail)
                .toHaveBeenCalledTimes(1);

            expect(mockSendMail)
                .toHaveBeenCalledWith(
                    expect.objectContaining({
                        to: "staff@test.com",
                    })
                );
        });
    });

    // =====================================================
    // sendAppointmentConfirmation
    // =====================================================

    describe("sendAppointmentConfirmation", () => {

        it("should send appointment confirmation email", async () => {

            await emailService.sendAppointmentConfirmation(
                "patient@test.com",
                "John Doe",
                "Clinic A",
                "123 Main Street",
                "2026-05-20",
                "10:00"
            );

            expect(mockSendMail)
                .toHaveBeenCalledTimes(1);

            expect(mockSendMail)
                .toHaveBeenCalledWith(
                    expect.objectContaining({
                        to: "patient@test.com",
                        subject: "Appointment Confirmed - Clinic A",
                        html: expect.stringContaining("Appointment Confirmed"),
                    })
                );
            expect(mockSendMail.mock.calls[0][0].html)
                .toContain("border-left:4px solid #2563eb");
            expect(mockSendMail.mock.calls[0][0].html)
                .toContain("View My Appointments");
        });

        it("should send rescheduled appointment email", async () => {

            await emailService.sendAppointmentConfirmation(
                "patient@test.com",
                "John Doe",
                "Clinic A",
                "123 Main Street",
                "2026-05-20",
                "10:00",
                true
            );

            expect(mockSendMail)
                .toHaveBeenCalledTimes(1);
            expect(mockSendMail.mock.calls[0][0].subject)
                .toBe("Appointment Rescheduled - Clinic A");
            expect(mockSendMail.mock.calls[0][0].html)
                .toContain("Appointment Rescheduled");
        });
    });

    // =====================================================
    // sendAppointmentCancellation
    // =====================================================

    describe("sendAppointmentCancellation", () => {

        it("should send cancellation email", async () => {

            await emailService.sendAppointmentCancellation(
                "patient@test.com",
                "John Doe",
                "Clinic A",
                "123 Main Street",
                "2026-05-20",
                "10:00"
            );

            expect(mockSendMail)
                .toHaveBeenCalledTimes(1);

            expect(mockSendMail)
                .toHaveBeenCalledWith(
                    expect.objectContaining({
                        to: "patient@test.com",
                        subject: "Appointment Cancelled - Clinic A",
                        html: expect.stringContaining("Appointment Cancelled"),
                    })
                );
            expect(mockSendMail.mock.calls[0][0].html)
                .toContain("border-left:4px solid #dc2626");
            expect(mockSendMail.mock.calls[0][0].html)
                .toContain("Book Another Appointment");
        });

        it("should build appointment links from the site origin when BASE_URL contains a page", async () => {
            jest.resetModules();
            process.env.BASE_URL = "https://smartclinic-hyb0fwfuf9d5crat.uaenorth-01.azurewebsites.net/signUp.html";
            jest.doMock("nodemailer", () => ({
                createTransport: jest.fn(() => ({
                    sendMail: mockSendMail,
                })),
            }));

            const pageBaseEmailService = require("../services/emailService");

            await pageBaseEmailService.sendAppointmentCancellation(
                "patient@test.com",
                "John Doe",
                "Clinic A",
                "123 Main Street",
                "2026-05-20",
                "10:00"
            );

            const html = mockSendMail.mock.calls[0][0].html;
            expect(html).toContain('href="https://smartclinic-hyb0fwfuf9d5crat.uaenorth-01.azurewebsites.net/apointments.html"');
            expect(html).not.toContain("signUp.html/apointments.html");

            process.env.BASE_URL = "http://localhost:3000";
        });
    });

    // =====================================================
    // sendQueueStatusUpdate
    // =====================================================

    describe("sendQueueStatusUpdate", () => {

        it("should send queue status update email", async () => {

            await emailService.sendQueueStatusUpdate(
                "patient@test.com",
                "John Doe",
                "Clinic A",
                "IN_CONSULTATION",
                "2026-05-20",
                "10:00 - 11:00"
            );

            expect(mockSendMail)
                .toHaveBeenCalledTimes(1);

            expect(mockSendMail)
                .toHaveBeenCalledWith(
                    expect.objectContaining({
                        to: "patient@test.com",
                        subject: "Queue Status Updated - Clinic A",
                    })
                );
        });
    });

    // =====================================================
    // sendAdminInvitation
    // =====================================================

    describe("sendAdminInvitation", () => {

        it("should send admin invitation email", async () => {

            await emailService.sendAdminInvitation(
                "admin@test.com",
                "Welcome Admin",
                "<h1>Hello Admin</h1>"
            );

            expect(mockSendMail)
                .toHaveBeenCalledTimes(1);

            expect(mockSendMail)
                .toHaveBeenCalledWith(
                    expect.objectContaining({
                        to: "admin@test.com",
                        subject: "Welcome Admin",
                    })
                );
        });
    });
});
