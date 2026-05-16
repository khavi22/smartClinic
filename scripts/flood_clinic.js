const { db } = require("../services/config/firebase");
const { admin } = require("../services/config/firebase");

async function floodClinic(targetAddress, numDays = 14) {
    console.log(`Searching for clinic at address: ${targetAddress}`);
    
    const clinicsSnap = await db.collection("clinics").get();
    let clinicId = null;
    let clinicName = "";

    clinicsSnap.forEach(doc => {
        const data = doc.data();
        if (data.address && data.address.toLowerCase().includes(targetAddress.toLowerCase())) {
            clinicId = doc.id;
            clinicName = data.name;
        }
    });

    if (!clinicId) {
        console.error("❌ Could not find a clinic with that address.");
        process.exit(1);
    }

    console.log(`✅ Found Clinic: ${clinicName} (${clinicId})`);
    console.log(`Flooding with appointments for the next ${numDays} days...`);

    const batchLimit = 400;
    let batch = db.batch();
    let count = 0;
    let total = 0;

    const today = new Date();

    for (let i = 0; i < numDays; i++) {
        const current = new Date(today);
        current.setDate(today.getDate() + i);
        const dateStr = current.toISOString().split('T')[0];
        const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday

        // Patterns:
        // Weekdays (1-5): Busy morning (9-11), quiet lunch (12-14), moderate afternoon (15-17)
        // Saturday (6): Quiet morning only
        // Sunday (0): Closed (no appointments)

        if (dayOfWeek === 0) continue; // Skip Sunday

        for (let hour = 9; hour <= 17; hour++) {
            if (dayOfWeek === 6 && hour > 12) break; // Saturday only morning

            let probability = 0.5;
            if (hour >= 9 && hour <= 11) probability = 0.9;
            else if (hour >= 12 && hour <= 14) probability = 0.2;
            else if (hour >= 15 && hour <= 17) probability = 0.6;

            // Generate 1-5 appointments per slot based on probability
            for (let j = 0; j < 5; j++) {
                if (Math.random() < probability) {
                    const docRef = db.collection("appointments").doc();
                    batch.set(docRef, {
                        clinicId: clinicId,
                        patientId: `test_user_${Math.floor(Math.random() * 1000)}`,
                        patientName: "Test Patient",
                        date: dateStr,
                        timeSlot: `${String(hour).padStart(2, '0')}:00`,
                        status: "booked", // Or completed
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        isMock: true
                    });
                    count++;
                    total++;

                    if (count >= batchLimit) {
                        await batch.commit();
                        batch = db.batch();
                        console.log(`Commited ${total} appointments...`);
                        count = 0;
                    }
                }
            }
        }
    }

    if (count > 0) {
        await batch.commit();
    }

    console.log(`✅ Done! Successfully flooded ${clinicName} with ${total} appointments.`);
    console.log(`You can now run 'Retrain Model' in the ML dashboard.`);
    process.exit(0);
}

const address = "27 De Beer St, Braamfontein";
floodClinic(address);
