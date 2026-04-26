const { db } = require("../services/config/firebase");

/**
 * Migration script to set 'approvalStatus' to 'approved' for all existing staff.
 * Run this once after deploying the new workflow to prevent existing staff from being locked out.
 */

async function migrateStaff() {
    console.log("Starting staff approval status migration...");
    
    try {
        const staffSnapshot = await db.collection("staff").get();
        
        if (staffSnapshot.empty) {
            console.log("No staff accounts found to migrate.");
            return;
        }

        const batch = db.batch();
        let count = 0;

        staffSnapshot.forEach(doc => {
            const data = doc.data();
            if (!data.approvalStatus) {
                batch.update(doc.ref, {
                    approvalStatus: "approved",
                    migratedAt: new Date().toISOString()
                });
                count++;
            }
        });

        if (count > 0) {
            await batch.commit();
            console.log(`Successfully migrated ${count} staff accounts to 'approved' status.`);
        } else {
            console.log("All staff accounts already have an approval status.");
        }

        // Also clean up staffCode from clinics
        console.log("Cleaning up staffCode from clinics...");
        const clinicsSnapshot = await db.collection("clinics").get();
        const clinicBatch = db.batch();
        let clinicCount = 0;

        clinicsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.staffCode) {
                clinicBatch.update(doc.ref, {
                    staffCode: null // Or use admin.firestore.FieldValue.delete() if preferred
                });
                clinicCount++;
            }
        });

        if (clinicCount > 0) {
            await clinicBatch.commit();
            console.log(`Successfully removed staffCode from ${clinicCount} clinics.`);
        }

    } catch (error) {
        console.error("Migration failed:", error);
    }
}

migrateStaff().then(() => {
    console.log("Migration complete.");
    process.exit(0);
});
