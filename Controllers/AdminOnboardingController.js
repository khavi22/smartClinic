/**
 * Admin Onboarding Controller
 * Handles admin onboarding flow for support team
 */

const { searchClinics, getClinicByPlaceId } = require("../services/clinicService");
const { sendAdminInvitation } = require("../services/emailService");
const { db } = require("../services/config/firebase");

/**
 * Search for clinics by name
 * POST /api/admin-onboarding/search
 */
exports.searchClinics = async (req, res) => {
    try {
        console.log("Admin onboarding - Search request:", req.body);

        const { query } = req.body;

        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: "Query is required and must be a non-empty string"
            });
        }

        const searchQuery = `clinic named ${query}`;
        const places = await searchClinics(searchQuery);

        res.json({
            success: true,
            places: places || [],
            count: places ? places.length : 0
        });
    } catch (error) {
        console.error("Error searching clinics:", error);
        res.status(500).json({
            success: false,
            message: "Failed to search clinics: " + error.message
        });
    }
};

/**
 * Get clinic admin code by place ID
 * POST /api/admin-onboarding/clinic-code
 */
exports.getClinicCode = async (req, res) => {
    try {
        console.log("Admin onboarding - Get clinic code request:", req.body);

        const { placeId } = req.body;

        if (!placeId || typeof placeId !== 'string') {
            return res.status(400).json({
                success: false,
                message: "Place ID is required"
            });
        }

        // Check if clinic exists in database
        const clinicDoc = await db.collection("clinics").doc(placeId).get();

        let adminCode;

        if (clinicDoc.exists) {
            adminCode = clinicDoc.data().adminCode;
        } else {
            // Create new clinic entry if it doesn't exist
            const { admin } = require("../services/config/firebase");
            const { v4: uuidv4 } = require("uuid");

            adminCode = "ADM-" + uuidv4().substring(0, 6).toUpperCase();
            
            const defaultHours = { open: "00:00", close: "24:00", isOpen: true };

            await db.collection("clinics").doc(placeId).set({
                placeId,
                clinicName: "Clinic", // Placeholder, will be updated during actual onboarding
                city: "",
                address: "",
                operatingHours: {
                    monday: { ...defaultHours },
                    tuesday: { ...defaultHours },
                    wednesday: { ...defaultHours },
                    thursday: { ...defaultHours },
                    friday: { ...defaultHours },
                    saturday: { ...defaultHours },
                    sunday: { ...defaultHours }
                },
                slotCapacity: 10,
                adminCode,
                adminUid: null,
                isActive: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        res.json({
            success: true,
            clinicId: placeId,
            adminCode: adminCode
        });
    } catch (error) {
        console.error("Error getting clinic code:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get clinic code: " + error.message
        });
    }
};

/**
 * Send admin invitation email
 * POST /api/admin-onboarding/send-invite
 */
exports.sendAdminInvite = async (req, res) => {
    try {
        console.log("Admin onboarding - Send invite request:", {
            ...req.body,
            adminEmail: req.body.adminEmail ? `${req.body.adminEmail.substring(0, 3)}...` : "N/A"
        });

        const {
            adminEmail,
            clinicId,
            clinicName,
            clinicAddress,
            adminCode
        } = req.body;

        // Validation
        const errors = [];

        if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
            errors.push("Valid admin email is required");
        }

        if (!clinicId) {
            errors.push("Clinic ID is required");
        }

        if (!clinicName) {
            errors.push("Clinic name is required");
        }

        if (!adminCode) {
            errors.push("Admin code is required");
        }

        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors
            });
        }

        // Check if clinic already has an admin
        const clinicDoc = await db.collection("clinics").doc(clinicId).get();
        if (clinicDoc.exists && clinicDoc.data().adminUid) {
            return res.status(409).json({
                success: false,
                message: "This clinic already has an assigned administrator. Cannot send invitation to a clinic with existing admin."
            });
        }

        // Update clinic document with admin info
        await db.collection("clinics").doc(clinicId).update({
            clinicName,
            address: clinicAddress || "",
            pendingAdminEmail: adminEmail.toLowerCase(),
            updatedAt: new Date()
        });

        // Send invitation email
        const subject = `SmartClinic Admin Invitation - ${clinicName}`;
        const html = generateAdminInvitationEmail({
            clinicName,
            clinicAddress,
            adminCode
        });

        await sendAdminInvitation(adminEmail, subject, html);

        // Log the invitation
        await db.collection("adminInvitations").add({
            clinicId,
            adminEmail: adminEmail.toLowerCase(),
            clinicName,
            adminCode,
            sentAt: new Date(),
            status: "pending"
        });

        res.json({
            success: true,
            message: `Invitation sent successfully to ${adminEmail}`,
            clinicId,
            adminEmail: adminEmail.toLowerCase()
        });
    } catch (error) {
        console.error("Error sending admin invite:", error);
        res.status(500).json({
            success: false,
            message: "Failed to send invitation: " + error.message
        });
    }
};

/**
 * Get admin invitation status
 * GET /api/admin-onboarding/invitation-status/:clinicId
 */
exports.getInvitationStatus = async (req, res) => {
    try {
        const { clinicId } = req.params;

        if (!clinicId) {
            return res.status(400).json({
                success: false,
                message: "Clinic ID is required"
            });
        }

        const snapshot = await db.collection("adminInvitations")
            .where("clinicId", "==", clinicId)
            .orderBy("sentAt", "desc")
            .limit(1)
            .get();

        if (snapshot.empty) {
            return res.json({
                success: true,
                invitation: null,
                message: "No invitation found for this clinic"
            });
        }

        const invitation = snapshot.docs[0].data();

        res.json({
            success: true,
            invitation: {
                ...invitation,
                clinicId,
                invitationId: snapshot.docs[0].id
            }
        });
    } catch (error) {
        console.error("Error getting invitation status:", error);
        res.status(500).json({
            success: false,
            message: "Failed to get invitation status: " + error.message
        });
    }
};

/**
 * Generate admin invitation email HTML
 */
function generateAdminInvitationEmail({ clinicName, clinicAddress, adminCode }) {
    return `
        <article style="font-family: 'Inter', sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <header style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 24px;">🏥 SmartClinic Admin Invitation</h1>
                <p style="margin: 8px 0 0 0; font-size: 12px; opacity: 0.9;">From SmartClinic Support Team</p>
            </header>
            <section style="padding: 32px; line-height: 1.6;">
                <p>Hello,</p>
                
                <p>You have been invited to become an administrator for <strong>${clinicName}</strong> on the SmartClinic platform.</p>
                
                <section style="background: #f0f4ff; border-left: 4px solid #667eea; padding: 20px; border-radius: 8px; margin: 24px 0;">
                    <h3 style="margin: 0 0 16px 0; color: #667eea; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Clinic Details</h3>
                    
                    <div style="margin: 12px 0; font-size: 14px;">
                        <strong>Clinic Name:</strong><br>
                        ${clinicName}
                    </div>
                    
                    ${clinicAddress ? `
                    <div style="margin: 12px 0; font-size: 14px;">
                        <strong>Location:</strong><br>
                        ${clinicAddress}
                    </div>
                    ` : ''}
                    
                    <div style="margin: 12px 0; font-size: 14px;">
                        <strong>Admin Code:</strong><br>
                        <code style="background: #1e293b; color: #10b981; padding: 8px 12px; border-radius: 4px; font-family: 'Courier New', monospace; font-weight: 600;">${adminCode}</code>
                    </div>
                </section>
                
                <h3 style="color: #667eea; margin: 24px 0 12px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Next Steps</h3>
                
                <ol style="margin: 0; padding-left: 20px;">
                    <li style="margin: 8px 0;">
                        <strong>Sign up</strong> on SmartClinic with this email address
                    </li>
                    <li style="margin: 8px 0;">
                        <strong>Use the admin code</strong> to claim your clinic during registration
                    </li>
                    <li style="margin: 8px 0;">
                        <strong>Set up your clinic</strong> - Add staff, set operating hours, and manage services
                    </li>
                    <li style="margin: 8px 0;">
                        <strong>Start using SmartClinic</strong> to manage appointments and your clinic operations
                    </li>
                </ol>
                
                <section style="text-align: center; margin: 32px 0;">
                    <a href="${process.env.BASE_URL}/signUp.html" 
                       style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
                       Sign Up Now
                    </a>
                </section>
                
                <p style="font-size: 13px; color: #64748b; margin-top: 24px;">
                    <strong>Need help?</strong> Contact the SmartClinic support team for assistance.
                </p>
            </section>
            <footer style="background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
                © 2026 SmartClinic. All rights reserved.<br>
                This is an automated email from the SmartClinic support team.
            </footer>
        </article>
    `;
}

module.exports = {
    searchClinics: exports.searchClinics,
    getClinicCode: exports.getClinicCode,
    sendAdminInvite: exports.sendAdminInvite,
    getInvitationStatus: exports.getInvitationStatus
};
