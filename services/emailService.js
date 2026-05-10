const nodemailer = require("nodemailer");
require("dotenv").config();
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const SMTP_HOST = defineSecret("SMTP_HOST");
const SMTP_PORT = defineSecret("SMTP_PORT");
const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASS = defineSecret("SMTP_PASS");
/**
 * Service to send emails via Nodemailer.
 * Configure these environment variables in your .env file:
 * SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 */

const BASE_URL = defineSecret("BASE_URL");


const transporter = nodemailer.createTransport({
    host: SMTP_HOST.value() || "smtp.gmail.com",
    port: parseInt(SMTP_PORT.value() || "465"),
    secure: SMTP_PORT.value() === "465", // true for 465, false for other ports
    auth: {
        user: SMTP_USER.value(),
        pass: SMTP_PASS.value(),
    },
});

const sendEmail = async (to, subject, html, fromName = "SmartClinic", replyTo = null) => {
    try {
        const mailOptions = {
            from: `"${fromName}" <${SMTP_USER.value()}>`,
            to: to,
            subject: subject,
            html: html,
            replyTo: replyTo || SMTP_USER.value()
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
        <div style="font-family: 'Inter', sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%); padding: 32px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 24px;">SmartClinic Invitation</h1>
            </div>
            <div style="padding: 32px; line-height: 1.6;">
                <p>Hello,</p>
                <p><strong>${adminName}</strong> has invited you to join the staff at <strong>${clinicName}</strong> on the SmartClinic platform.</p>
                <p>Please register using this email address to get started with your new account.</p>
                <div style="text-align: center; margin: 32px 0;">
                    <a href="${BASE_URL}signUp.html" 
                       style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
                       Finalize Registration
                    </a>
                </div>
                <p style="font-size: 14px; color: #64748b;">Note: After signing up, your account will undergo a brief review by the administrator before access is granted.</p>
            </div>
            <div style="background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                © 2026 SmartClinic. All rights reserved.
            </div>
        </div>
    `;
    await sendEmail(email, subject, html, adminName, adminEmail);
};

const sendStaffApproval = async (email, clinicName, adminName, adminEmail) => {
    const subject = `Account Approved - ${clinicName}`;
    const html = `
        <div style="font-family: 'Inter', sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background: #10b981; padding: 32px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 24px;">Account Approved</h1>
            </div>
            <div style="padding: 32px; line-height: 1.6;">
                <p>Great news!</p>
                <p>Your staff account for <strong>${clinicName}</strong> has been approved by <strong>${adminName}</strong>.</p>
                <p>You can now log in and access the Staff Dashboard to manage appointments and clinic settings.</p>
                <div style="text-align: center; margin: 32px 0;">
                    <a href="${BASE_URL}login.html" 
                       style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
                       Login to Dashboard
                    </a>
                </div>
            </div>
        </div>
    `;
    await sendEmail(email, subject, html, adminName, adminEmail);
};

const sendStaffRejection = async (email, clinicName, adminName, adminEmail) => {
    const subject = `Staff Application Status - ${clinicName}`;
    const html = `
        <div style="font-family: 'Inter', sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background: #ef4444; padding: 32px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 24px;">Application Status</h1>
            </div>
            <div style="padding: 32px; line-height: 1.6;">
                <p>Hello,</p>
                <p>Thank you for your interest in joining <strong>${clinicName}</strong>.</p>
                <p>We regret to inform you that your application has been declined by <strong>${adminName}</strong> at this time.</p>
                <p>If you have any questions or believe this was an error, please reach out to the clinic directly.</p>
            </div>
        </div>
    `;
    await sendEmail(email, subject, html, adminName, adminEmail);
};

module.exports = {
    sendStaffInvitation,
    sendStaffApproval,
    sendStaffRejection
};
