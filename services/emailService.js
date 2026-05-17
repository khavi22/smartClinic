const nodemailer = require("nodemailer");
require("dotenv").config();

/**
 * Service to send emails via Nodemailer.
 * Configure these environment variables in your .env file or deployment settings:
 * SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 */

// Environment variables should be used for SMTP configuration
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const BASE_URL = process.env.BASE_URL;

if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !BASE_URL) {
    console.warn("⚠️ Warning: Email service is missing some configuration variables (SMTP_* or BASE_URL).");
}

const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT),
    secure: SMTP_PORT === "465", // true for 465, false for other ports
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
    },
});

const sendEmail = async (to, subject, html, fromName = "SmartClinic", replyTo = null) => {
    try {
        const mailOptions = {
            from: `"${fromName}" <${SMTP_USER}>`,
            to: to,
            subject: subject,
            html: html,
            replyTo: replyTo || SMTP_USER
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${to}: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error("Error sending email via Nodemailer:", error);
        throw error;
    }
};

const sendStaffInvitation = async (email, clinicName, adminName, adminEmail) => {
    const subject = `${adminName} has invited you to join ${clinicName}`;
    const html = `
        <article style="font-family: 'Inter', sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <header style="background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%); padding: 32px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 24px;">SmartClinic Invitation</h1>
            </header>
            <section style="padding: 32px; line-height: 1.6;">
                <p>Hello,</p>
                <p><strong>${adminName}</strong> has invited you to join the staff at <strong>${clinicName}</strong> on the SmartClinic platform.</p>
                <p>Please register using this email address to get started with your new account.</p>
                <section style="text-align: center; margin: 32px 0;">
                    <a href="${BASE_URL}/signUp.html" 
                       style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
                       Finalize Registration
                    </a>
                </section>
                <p style="font-size: 14px; color: #64748b;">Note: After signing up, your account will undergo a brief review by the administrator before access is granted.</p>
            </section>
            <footer style="background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                © 2026 SmartClinic. All rights reserved.
            </footer>
        </article>
    `;
    await sendEmail(email, subject, html, adminName, adminEmail);
};

const sendStaffApproval = async (email, clinicName, adminName, adminEmail) => {
    const subject = `Account Approved - ${clinicName}`;
    const html = `
        <article style="font-family: 'Inter', sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <header style="background: #10b981; padding: 32px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 24px;">Account Approved</h1>
            </header>
            <section style="padding: 32px; line-height: 1.6;">
                <p>Great news!</p>
                <p>Your staff account for <strong>${clinicName}</strong> has been approved by <strong>${adminName}</strong>.</p>
                <p>You can now log in and access the Staff Dashboard to manage appointments and clinic settings.</p>
                <section style="text-align: center; margin: 32px 0;">
                    <a href="${BASE_URL}/login.html" 
                       style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
                       Login to Dashboard
                    </a>
                </section>
            </section>
        </article>
    `;
    await sendEmail(email, subject, html, adminName, adminEmail);
};

const sendStaffRejection = async (email, clinicName, adminName, adminEmail) => {
    const subject = `Staff Application Status - ${clinicName}`;
    const html = `
        <article style="font-family: 'Inter', sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <header style="background: #ef4444; padding: 32px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 24px;">Application Status</h1>
            </header>
            <section style="padding: 32px; line-height: 1.6;">
                <p>Hello,</p>
                <p>Thank you for your interest in joining <strong>${clinicName}</strong>.</p>
                <p>We regret to inform you that your application has been declined by <strong>${adminName}</strong> at this time.</p>
                <p>If you have any questions or believe this was an error, please reach out to the clinic directly.</p>
            </section>
        </article>
    `;
    await sendEmail(email, subject, html, adminName, adminEmail);
};
const sendAppointmentConfirmation = async (email, patientName, clinicName, clinicAddress, date, timeSlot, isReschedule = false) => {
    const subject = isReschedule
        ? `Appointment Rescheduled - ${clinicName}`
        : `Appointment Confirmed - ${clinicName}`;

    const headerColor = isReschedule ? "#f59e0b" : "#2563eb";
    const headerTitle = isReschedule ? "Appointment Rescheduled" : "Appointment Confirmed";
    const introText   = isReschedule
        ? `Your appointment at <strong>${clinicName}</strong> has been rescheduled. Here are your updated details:`
        : `Your appointment at <strong>${clinicName}</strong> has been successfully booked. Here are your details:`;

    const html = `
        <article style="font-family: 'Inter', sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <header style="background: ${headerColor}; padding: 32px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 24px;">${headerTitle}</h1>
            </header>
            <section style="padding: 32px; line-height: 1.6;">
                <p>Hello <strong>${patientName}</strong>,</p>
                <p>${introText}</p>
                <section style="background: #f8fafc; border-left: 4px solid ${headerColor}; border-radius: 8px; padding: 20px; margin: 24px 0;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; font-size: 13px; color: #64748b; width: 40%;">Clinic</td>
                            <td style="padding: 8px 0; font-size: 15px; font-weight: 600;">${clinicName}</td>
                        </tr>
                        <tr style="border-top: 1px solid #e2e8f0;">
                            <td style="padding: 8px 0; font-size: 13px; color: #64748b;">Address</td>
                            <td style="padding: 8px 0; font-size: 15px; font-weight: 600;">${clinicAddress}</td>
                        </tr>
                        <tr style="border-top: 1px solid #e2e8f0;">
                            <td style="padding: 8px 0; font-size: 13px; color: #64748b;">Date</td>
                            <td style="padding: 8px 0; font-size: 15px; font-weight: 600;">${date}</td>
                        </tr>
                        <tr style="border-top: 1px solid #e2e8f0;">
                            <td style="padding: 8px 0; font-size: 13px; color: #64748b;">Time</td>
                            <td style="padding: 8px 0; font-size: 15px; font-weight: 600;">${timeSlot}</td>
                        </tr>
                    </table>
                </section>
                <p style="font-size: 14px; color: #64748b;">Please arrive 10 minutes early. Remember to bring your ID and medical aid card if applicable.</p>
                <section style="text-align: center; margin: 32px 0;">
                    <a href="${BASE_URL}/appointments.html"
                       style="background: ${headerColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
                       View My Appointments
                    </a>
                </section>
            </section>
            <footer style="background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                © 2026 SmartClinic. All rights reserved.
            </footer>
        </article>
    `;
    await sendEmail(email, subject, html, "SmartClinic");
};

const sendAppointmentCancellation = async (email, patientName, clinicName, clinicAddress, date, timeSlot) => {
    const subject = `Appointment Cancelled - ${clinicName}`;
    const html = `
        <article style="font-family: 'Inter', sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <header style="background: #ef4444; padding: 32px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 24px;">Appointment Cancelled</h1>
            </header>
            <section style="padding: 32px; line-height: 1.6;">
                <p>Hello <strong>${patientName}</strong>,</p>
                <p>Your appointment at <strong>${clinicName}</strong> has been cancelled. Here are the details of the cancelled booking:</p>
                <section style="background: #f8fafc; border-left: 4px solid #ef4444; border-radius: 8px; padding: 20px; margin: 24px 0;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; font-size: 13px; color: #64748b; width: 40%;">Clinic</td>
                            <td style="padding: 8px 0; font-size: 15px; font-weight: 600;">${clinicName}</td>
                        </tr>
                        <tr style="border-top: 1px solid #e2e8f0;">
                            <td style="padding: 8px 0; font-size: 13px; color: #64748b;">Address</td>
                            <td style="padding: 8px 0; font-size: 15px; font-weight: 600;">${clinicAddress}</td>
                        </tr>
                        <tr style="border-top: 1px solid #e2e8f0;">
                            <td style="padding: 8px 0; font-size: 13px; color: #64748b;">Date</td>
                            <td style="padding: 8px 0; font-size: 15px; font-weight: 600;">${date}</td>
                        </tr>
                        <tr style="border-top: 1px solid #e2e8f0;">
                            <td style="padding: 8px 0; font-size: 13px; color: #64748b;">Time</td>
                            <td style="padding: 8px 0; font-size: 15px; font-weight: 600;">${timeSlot}</td>
                        </tr>
                    </table>
                </section>
                <p style="font-size: 14px; color: #64748b;">If you did not request this cancellation or would like to rebook, please contact the clinic directly.</p>
                <section style="text-align: center; margin: 32px 0;">
                    <a href="${BASE_URL}/appointments.html"
                       style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
                       Book a New Appointment
                    </a>
                </section>
            </section>
            <footer style="background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                © 2026 SmartClinic. All rights reserved.
            </footer>
        </article>
    `;
    await sendEmail(email, subject, html, "SmartClinic");
};
module.exports = {
    sendStaffInvitation,
    sendStaffApproval,
    sendStaffRejection,
    sendAppointmentConfirmation,
    sendAppointmentCancellation
};
