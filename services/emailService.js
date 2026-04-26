const { db } = require("./config/firebase");

/**
 * Service to send emails via Firebase Trigger Email extension.
 * This works by writing documents to the 'mail' collection.
 */

const sendEmail = async (to, subject, html) => {
    try {
        await db.collection("mail").add({
            to: [to],
            message: {
                subject: subject,
                html: html,
            },
            createdAt: new Date().toISOString()
        });
        console.log(`Email queued for ${to}: ${subject}`);
    } catch (error) {
        console.error("Error queueing email:", error);
    }
};

const sendStaffInvitation = async (email, clinicName) => {
    const subject = `Invitation to join ${clinicName} on SmartClinic`;
    const html = `
        <h1>Welcome to SmartClinic</h1>
        <p>You have been invited to join the staff at <strong>${clinicName}</strong>.</p>
        <p>Please register on our platform using this email address to get started.</p>
        <p><a href="https://smartclinic-app.web.app/signUp.html">Sign Up Here</a></p>
        <p>After signing up, your account will be pending administrator approval.</p>
    `;
    await sendEmail(email, subject, html);
};

const sendStaffApproval = async (email, clinicName) => {
    const subject = `Account Approved - ${clinicName}`;
    const html = `
        <h1>Account Approved</h1>
        <p>Your staff account for <strong>${clinicName}</strong> has been approved by the administrator.</p>
        <p>You can now log in to the Staff Dashboard.</p>
        <p><a href="https://smartclinic-app.web.app/login.html">Login Here</a></p>
    `;
    await sendEmail(email, subject, html);
};

const sendStaffRejection = async (email, clinicName) => {
    const subject = `Staff Application Status - ${clinicName}`;
    const html = `
        <h1>Application Update</h1>
        <p>We regret to inform you that your staff application for <strong>${clinicName}</strong> has been declined at this time.</p>
        <p>If you believe this is a mistake, please contact your clinic administrator.</p>
    `;
    await sendEmail(email, subject, html);
};

module.exports = {
    sendStaffInvitation,
    sendStaffApproval,
    sendStaffRejection
};
