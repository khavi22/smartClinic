// seedMockQueue.js
// Run with: node seedMockQueue.js
// Adds 2 weeks of mock walk-in queue data for clinic ChIJPRRsEHUNlR4RGKv7Sn9-KWk

require("dotenv").config();
const admin = require("firebase-admin");

const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS_JSON);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// ── CONFIG ───────────────────────────────────────────────────
const CLINIC_ID = "ChIJPRRsEHUNlR4RGKv7Sn9-KWk";
const STAFF_ID = "wjvKln6luyZTV1vmtrPbWxlrTNK2";

const SERVICES = [
    { serviceId: "BrovLizm40Bd16wcmDrU", serviceName: "Nutrition Consultation", serviceDuration: 45 },
    { serviceId: "T7ITB1JJFJI0x5byF3FC", serviceName: "Occupational Therapy", serviceDuration: 60 }
];

const TIME_SLOTS = [
    "08:00 - 09:00", "09:00 - 10:00", "10:00 - 11:00", "11:00 - 12:00",
    "12:00 - 13:00", "13:00 - 14:00", "14:00 - 15:00", "15:00 - 16:00",
    "16:00 - 17:00"
];

const STATUSES = ["COMPLETE", "COMPLETE", "COMPLETE", "WAITING", "IN_CONSULTATION"];

const PATIENT_NAMES = [
    "Thabo Nkosi", "Lerato Dlamini", "Sipho Zulu", "Nomsa Khumalo",
    "Bongani Mthembu", "Zanele Ndlovu", "Mandla Sithole", "Precious Mokoena",
    "Thandeka Mahlangu", "Lungelo Buthelezi", "Ayanda Cele", "Nompilo Hadebe",
    "Sibusiso Mhlongo", "Nokwanda Mchunu", "Sandile Gwala", "Phindile Ntuli",
    "Mduduzi Shabalala", "Nonhlanhla Zungu", "Lwazi Mnguni", "Simphiwe Gumede",
    "Khanyisile Majola", "Siyanda Madlala", "Nothando Ngcobo", "Mlungisi Nzama"
];

// ── HELPERS ──────────────────────────────────────────────────
function getDatesForLastTwoWeeks() {
    const dates = [];
    for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        // skip sundays
        if (d.getDay() === 0) continue;
        dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
}

function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildTimestampForSlot(dateStr, timeSlot, offsetMinutes = 0) {
    const [hourStr] = timeSlot.split(":");
    const date = new Date(dateStr);
    date.setHours(parseInt(hourStr), offsetMinutes, 0, 0);
    return admin.firestore.Timestamp.fromDate(date);
}

function buildQueueItem(dateStr, timeSlot, patientName, status) {
    const service = randomFrom(SERVICES);
    const createdAt = buildTimestampForSlot(dateStr, timeSlot, randomInt(0, 10));
    const consultationStartedAt = buildTimestampForSlot(dateStr, timeSlot, randomInt(5, 25));
    const consultationCompletedAt = buildTimestampForSlot(dateStr, timeSlot, randomInt(26, 55));
    const actualDuration = randomInt(10, 55);

    const base = {
        clinicId: CLINIC_ID,
        date: dateStr,
        patientName,
        patientId: null,
        timeSlot,
        appointmentTime: timeSlot,
        addedBy: STAFF_ID,
        assignedStaffId: STAFF_ID,
        updatedBy: STAFF_ID,
        priority: 0,
        queueNumber: Date.now() + Math.floor(Math.random() * 10000),
        status,
        serviceId: service.serviceId,
        serviceName: service.serviceName,
        serviceDuration: service.serviceDuration,
        actualDuration,
        createdAt,
        updatedAt: consultationCompletedAt
    };

    if (status === "COMPLETE") {
        base.consultationStartedAt = consultationStartedAt;
        base.consultationCompletedAt = consultationCompletedAt;
        base.completedAt = consultationCompletedAt;
    } else if (status === "IN_CONSULTATION") {
        base.consultationStartedAt = consultationStartedAt;
    }

    return base;
}

// ── SEED ─────────────────────────────────────────────────────
async function seed() {
    const dates = getDatesForLastTwoWeeks();
    let totalAdded = 0;

    for (const dateStr of dates) {
        console.log(`\nSeeding date: ${dateStr}`);

        // Shuffle patient names for variety per day
        const shuffledNames = [...PATIENT_NAMES].sort(() => Math.random() - 0.5);
        let nameIndex = 0;

        for (const timeSlot of TIME_SLOTS) {
            // Random 1-4 patients per slot
            const count = randomInt(1, 4);

            for (let i = 0; i < count; i++) {
                const patientName = shuffledNames[nameIndex % shuffledNames.length];
                nameIndex++;

                const status = randomFrom(STATUSES);
                const item = buildQueueItem(dateStr, timeSlot, patientName, status);

                await db
                    .collection("clinics").doc(CLINIC_ID)
                    .collection("queues").doc(dateStr)
                    .collection("patients")
                    .add(item);

                totalAdded++;
                console.log(`  ✓ ${timeSlot} — ${patientName} [${status}]`);
            }
        }
    }

    console.log(`\n✅ Done. Added ${totalAdded} queue items across ${dates.length} days.`);
    process.exit(0);
}

seed().catch(err => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
});