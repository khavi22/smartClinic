const admin = require("firebase-admin");


if (!admin.apps.length) {
    const credentialsJson = process.env.FIREBASE_CREDENTIALS_JSON;

    if (credentialsJson) {
        try {
            const serviceAccount = JSON.parse(credentialsJson);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log("✓ Firebase Admin initialized from environment variable.");
        } catch (err) {
            console.error("❌ ERROR: Failed to parse FIREBASE_CREDENTIALS_JSON:", err.message);
            throw err;
        }
    } else if (process.env.NODE_ENV === 'test') {
        console.warn("⚠️ Running in TEST mode without real Firebase credentials.");
        // Initialize with just the project ID for testing purposes
        admin.initializeApp({
            projectId: "test-project"
        });
    } else {
        console.error("❌ ERROR: FIREBASE_CREDENTIALS_JSON is missing from environment variables.");
        throw new Error("Missing Firebase Credentials");
    }
}

const db = admin.firestore();

module.exports = { admin, db };