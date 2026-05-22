const admin = require("firebase-admin");


// Initializes the Firebase Admin SDK once per Node process. In production it
// expects service account JSON in FIREBASE_CREDENTIALS_JSON; in tests it uses a
// lightweight projectId-only setup so modules can load without real secrets.
if (!admin.apps.length) {
    const credentialsJson = process.env.FIREBASE_CREDENTIALS_JSON;

    if (credentialsJson) {
        try {
            // Check if the string was pasted with extra quotes
            let cleanedJson = credentialsJson.trim();
            if (cleanedJson.startsWith('"') && cleanedJson.endsWith('"')) {
                cleanedJson = cleanedJson.substring(1, cleanedJson.length - 1).replace(/\\"/g, '"');
            }

            const serviceAccount = JSON.parse(cleanedJson);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log("BACKEND: Firebase Admin initialized successfully.");
        } catch (err) {
            console.error(" BACKEND ERROR: Failed to parse FIREBASE_CREDENTIALS_JSON. Make sure it is valid JSON.");
            console.error("Error details:", err.message);
            throw err;
        }
    } else if (process.env.NODE_ENV === 'test') {
        console.warn(" Running in TEST mode without real Firebase credentials.");
        // Initialize with just the project ID for testing purposes
        admin.initializeApp({
            projectId: "test-project"
        });
    } else {
        console.error("ERROR: FIREBASE_CREDENTIALS_JSON is missing from environment variables.");
        throw new Error("Missing Firebase Credentials");
    }
}

const db = admin.firestore();

module.exports = { admin, db };
