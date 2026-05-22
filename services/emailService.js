const nodemailer = require("nodemailer");
require("dotenv").config();

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const BASE_URL = process.env.BASE_URL;

// Shared SMTP transporter used by every email helper below.
const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT),
    secure: SMTP_PORT === "465",
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
    },
});

// Sends one HTML email with the configured SMTP account and an optional custom
// sender display name/reply-to address.
const sendEmail = async (
    to,
    subject,
    html,
    fromName = "SmartClinic",
    replyTo = null
) => {

    const mailOptions = {
        from: `"${fromName}" <${SMTP_USER}>`,
        to,
        subject,
        html,
        replyTo: replyTo || SMTP_USER,
    };

    return transporter.sendMail(mailOptions);
};

// Escapes dynamic email content before inserting it into HTML templates.
const escapeHtml = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Normalizes BASE_URL so email buttons point back to the web app root.
const getAppBaseUrl = () => {
    if (!BASE_URL) {
        return null;
    }

    try {
        return new URL(BASE_URL).origin;
    } catch (_error) {
        return BASE_URL
            .replace(/\/[^/?#]*\.html(?:[?#].*)?$/, "")
            .replace(/\/$/, "");
    }
};

// Builds the reusable appointment email layout used for confirmations,
// reschedules, and cancellations.
const buildAppointmentEmail = ({
    title,
    greeting,
    intro,
    clinicName,
    clinicAddress,
    date,
    timeSlot,
    accentColor = "#2563eb",
    actionLabel = "View My Appointments",
    note = "Please arrive 10 minutes early. Remember to bring your ID and medical aid card if applicable.",
}) => {
    const appBaseUrl = getAppBaseUrl();
    const appointmentsUrl = appBaseUrl
        ? `${appBaseUrl}/apointments.html`
        : "#";

    return `
        <div style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f5f7fb;margin:0;padding:32px 0;">
                <tr>
                    <td align="center" style="padding:0 16px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;max-width:620px;background:#ffffff;border:1px solid #d9e2ef;border-radius:8px;overflow:hidden;">
                            <tr>
                                <td style="background:${accentColor};padding:28px 24px;text-align:center;">
                                    <h1 style="margin:0;color:#ffffff;font-size:24px;line-height:1.3;font-weight:700;">${escapeHtml(title)}</h1>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding:36px 34px 34px;">
                                    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;font-weight:700;color:#111827;">Hello ${escapeHtml(greeting)}</p>
                                    <p style="margin:0 0 26px;font-size:14px;line-height:1.6;color:#111827;">${intro}</p>

                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f8fafc;border-left:4px solid ${accentColor};border-radius:8px;margin:0 0 26px;">
                                        <tr>
                                            <td style="padding:18px 20px;">
                                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                                                    <tr>
                                                        <td style="padding:10px 0;border-bottom:1px solid #d9e2ef;color:#64748b;font-size:13px;width:38%;">Clinic</td>
                                                        <td style="padding:10px 0;border-bottom:1px solid #d9e2ef;color:#1f2937;font-size:14px;font-weight:700;">${escapeHtml(clinicName)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td style="padding:10px 0;border-bottom:1px solid #d9e2ef;color:#64748b;font-size:13px;">Address</td>
                                                        <td style="padding:10px 0;border-bottom:1px solid #d9e2ef;color:#1f2937;font-size:14px;font-weight:700;line-height:1.5;">${escapeHtml(clinicAddress)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td style="padding:10px 0;border-bottom:1px solid #d9e2ef;color:#64748b;font-size:13px;">Date</td>
                                                        <td style="padding:10px 0;border-bottom:1px solid #d9e2ef;color:#1f2937;font-size:14px;font-weight:700;">${escapeHtml(date)}</td>
                                                    </tr>
                                                    <tr>
                                                        <td style="padding:10px 0;color:#64748b;font-size:13px;">Time</td>
                                                        <td style="padding:10px 0;color:#1f2937;font-size:14px;font-weight:700;">${escapeHtml(timeSlot)}</td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>

                                    <p style="margin:0 0 30px;font-size:14px;line-height:1.6;color:#475569;">${escapeHtml(note)}</p>
                                    <div style="text-align:center;">
                                        <a href="${escapeHtml(appointmentsUrl)}" style="display:inline-block;background:${accentColor};color:#ffffff;text-decoration:none;border-radius:7px;padding:14px 24px;font-size:13px;font-weight:700;">${escapeHtml(actionLabel)}</a>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <td style="background:#f8fafc;border-top:1px solid #d9e2ef;padding:20px;text-align:center;color:#8aa0b8;font-size:12px;">
                                    &copy; 2026 SmartClinic. All rights reserved.
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </div>
    `;
};

// Emails an invited staff member that a clinic admin has asked them to join.
const sendStaffInvitation = async (
    email,
    clinicName,
    adminName,
    adminEmail
) => {

    const subject =
        `${adminName} has invited you to join ${clinicName}`;

    const html = `<p>Invitation Email</p>`;

    return sendEmail(
        email,
        subject,
        html,
        adminName,
        adminEmail
    );
};

// Notifies a staff member that their clinic account was approved.
const sendStaffApproval = async (
    email,
    clinicName,
    adminName,
    adminEmail
) => {

    const subject = `Account Approved - ${clinicName}`;

    const html = `<p>Approved</p>`;

    return sendEmail(
        email,
        subject,
        html,
        adminName,
        adminEmail
    );
};

// Notifies a staff member that their clinic application was rejected.
const sendStaffRejection = async (
    email,
    clinicName,
    adminName,
    adminEmail
) => {

    const subject =
        `Staff Application Status - ${clinicName}`;

    const html = `<p>Rejected</p>`;

    return sendEmail(
        email,
        subject,
        html,
        adminName,
        adminEmail
    );
};

// Sends a patient either a first booking confirmation or a reschedule
// confirmation, depending on the isReschedule flag.
const sendAppointmentConfirmation = async (
    email,
    patientName,
    clinicName,
    clinicAddress,
    date,
    timeSlot,
    isReschedule = false
) => {

    const subject = isReschedule
        ? `Appointment Rescheduled - ${clinicName}`
        : `Appointment Confirmed - ${clinicName}`;
    const title = isReschedule
        ? "Appointment Rescheduled"
        : "Appointment Confirmed";
    const intro = isReschedule
        ? `Your appointment at <strong>${escapeHtml(clinicName)}</strong> has been successfully rescheduled. Here are your updated details:`
        : `Your appointment at <strong>${escapeHtml(clinicName)}</strong> has been successfully booked. Here are your details:`;

    const html = buildAppointmentEmail({
        title,
        greeting: patientName,
        intro,
        clinicName,
        clinicAddress,
        date,
        timeSlot,
        accentColor: "#2563eb",
    });

    return sendEmail(email, subject, html);
};

// Sends a patient an appointment cancellation notice.
const sendAppointmentCancellation = async (
    email,
    patientName,
    clinicName,
    clinicAddress,
    date,
    timeSlot
) => {

    const subject =
        `Appointment Cancelled - ${clinicName}`;
    const intro = `Your appointment at <strong>${escapeHtml(clinicName)}</strong> has been cancelled. Here are the cancelled appointment details:`;

    const html = buildAppointmentEmail({
        title: "Appointment Cancelled",
        greeting: patientName,
        intro,
        clinicName,
        clinicAddress,
        date,
        timeSlot,
        accentColor: "#dc2626",
        actionLabel: "Book Another Appointment",
        note: "If this was a mistake, please book another appointment or contact the clinic for assistance.",
    });

    return sendEmail(email, subject, html);
};

// Sends a short notification when a patient's queue status changes.
const sendQueueStatusUpdate = async (
    email,
    patientName,
    clinicName,
    status,
    date,
    timeSlot
) => {

    const formattedStatus = String(status || "")
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (letter) => letter.toUpperCase());

    const subject = `Queue Status Updated - ${clinicName || "SmartClinic"}`;

    const html = `
        <h1>Queue Status Updated</h1>
        <p>Hello ${patientName || "there"}</p>
        <p>Your queue status at ${clinicName || "your clinic"} is now: <strong>${formattedStatus}</strong></p>
        ${date ? `<p>Date: ${date}</p>` : ""}
        ${timeSlot ? `<p>Time: ${timeSlot}</p>` : ""}
    `;

    return sendEmail(email, subject, html);
};

// Sends support-team generated admin onboarding invitations.
const sendAdminInvitation = async (
    email,
    subject,
    html
) => {

    return sendEmail(
        email,
        subject,
        html,
        "SmartClinic Support"
    );
};

module.exports = {
    sendEmail,
    sendStaffInvitation,
    sendStaffApproval,
    sendStaffRejection,
    sendAppointmentConfirmation,
    sendAppointmentCancellation,
    sendQueueStatusUpdate,
    sendAdminInvitation,
};
