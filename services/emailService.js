const nodemailer = require("nodemailer");
require("dotenv").config();

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const BASE_URL = process.env.BASE_URL;

const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT),
    secure: SMTP_PORT === "465",
    auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
    },
});

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

    const html = `
        <h1>${subject}</h1>
        <p>Hello ${patientName}</p>
        <p>${clinicName}</p>
        <p>${clinicAddress}</p>
        <p>${date}</p>
        <p>${timeSlot}</p>
    `;

    return sendEmail(email, subject, html);
};

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

    const html = `
        <h1>Appointment Cancelled</h1>
        <p>Hello ${patientName}</p>
        <p>${clinicName}</p>
        <p>${clinicAddress}</p>
        <p>${date}</p>
        <p>${timeSlot}</p>
    `;

    return sendEmail(email, subject, html);
};

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
