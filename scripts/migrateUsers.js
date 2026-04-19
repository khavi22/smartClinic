const { db, admin } = require("../services/config/firebase");

async function migrate() {
    console.log("Starting migration...");

    // 1. Migrate Patients to Users
    console.log("Migrating patients to users collection...");
    const patientsSnapshot = await db.collection("patients").get();
    console.log(`Found ${patientsSnapshot.size} patients.`);

    for (const doc of patientsSnapshot.docs) {
        const data = doc.data();
        const uid = doc.id;

        console.log(`Migrating patient: ${uid} (${data.email})`);
        
        // Check if user already exists in users
        const userDoc = await db.collection("users").doc(uid).get();
        if (!userDoc.exists) {
            await db.collection("users").doc(uid).set({
                ...data,
                role: "patient",
                createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp()
            });
            
            // Set custom claims
            await admin.auth().setCustomUserClaims(uid, { role: "patient" });
            console.log(`- Created user profile and set claims.`);
        } else {
            console.log(`- User already exists in 'users' collection. Skipping.`);
        }
    }

    // 2. Add staffCode to existing clinics
    console.log("\nAdding staffCode to existing clinics...");
    const clinicsSnapshot = await db.collection("clinics").get();
    console.log(`Found ${clinicsSnapshot.size} clinics.`);

    const { v4: uuidv4 } = require('uuid');

    for (const doc of clinicsSnapshot.docs) {
        const data = doc.data();
        if (!data.staffCode) {
            const staffCode = "STF-" + uuidv4().substring(0, 6).toUpperCase();
            console.log(`Clinic ${doc.id}: Adding staffCode ${staffCode}`);
            await db.collection("clinics").doc(doc.id).update({
                staffCode: staffCode
            });
        } else {
            console.log(`Clinic ${doc.id}: Already has staffCode ${data.staffCode}`);
        }
    }

    console.log("\nMigration complete!");
}

migrate().catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
});
