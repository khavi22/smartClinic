// seedAppointments.js
// Run with: node seedAppointments.js
// Adds ~1 month of mock appointment data for Hillbrow Clinic

require("dotenv").config();
const admin = require("firebase-admin");

const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS_JSON);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// ── CONFIG ───────────────────────────────────────────────────
const CLINIC_ID   = "ChIJExgRGs4NlR4RMcO4P5F8umc";
const CLINIC_NAME = "Hillbrow Clinic";
const CLINIC_ADDRESS = "51 Klein St, Hillbrow, Johannesburg, 2017, South Africa";

const SERVICES = [
    { serviceId: "svc_gop_001", serviceName: "General Outpatient Consultation", serviceDuration: 30 },
    { serviceId: "svc_emr_002", serviceName: "Emergency & Casualty",            serviceDuration: 45 },
    { serviceId: "svc_mch_003", serviceName: "Maternal & Child Health",         serviceDuration: 40 },
];

const TIME_SLOTS = [
    "07:00 - 08:00", "08:00 - 09:00", "09:00 - 10:00", "10:00 - 11:00",
    "11:00 - 12:00", "12:00 - 13:00", "13:00 - 14:00", "14:00 - 15:00",
    "15:00 - 16:00", "16:00 - 17:00"
];

// Weight: past appointments skew toward booked/completed states
// booked appears more often so we also get "missed" and "cancelled" variety
const STATUSES = [
    "booked", "booked", "booked",
    "cancelled", "cancelled",
    "missed", "missed",
    "pending"
];

const PATIENT_NAMES = [
    "Kagiso Sithole", "Refilwe Mokoena", "Tebogo Dlamini", "Naledi Mahlangu",
    "Mpho Nkosi", "Kefilwe Molefe", "Katlego Motsepe", "Boitumelo Sefako",
    "Lesego Tau", "Dineo Sekgobela", "Tshepo Ramahlele", "Mmabatho Tladi",
    "Karabo Matlala", "Palesa Moshoeshoe", "Lethabo Khoza", "Tumelo Ntseki",
    "Amogelang Moagi", "Gosiame Mothibi", "Phenyo Seleke", "Keabetswe Phiri",
    "Wandile Dube", "Nosipho Radebe", "Sibongile Ntanzi", "Mthokozisi Nxumalo"
];

// ── HELPERS ──────────────────────────────────────────────────
function getDatesForLastMonth() {
    const dates = [];
    const today = new Date();
    for (let i = 30; i >= 1; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
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

function buildISOForSlot(dateStr, timeSlot, offsetMinutes = 0) {
    const [hourStr] = timeSlot.split(":");
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    date.setUTCHours(parseInt(hourStr), offsetMinutes, 0, 0);
    return date.toISOString();
}

function buildAppointment(dateStr, timeSlot, patientIndex) {
    const service  = randomFrom(SERVICES);
    const status   = randomFrom(STATUSES);
    const patientId = `patient_${String(patientIndex).padStart(3, "0")}`;
    const createdAt = buildISOForSlot(dateStr, timeSlot, randomInt(0, 15));

    return {
        clinicId:        CLINIC_ID,
        clinicName:      CLINIC_NAME,
        clinicAddress:   CLINIC_ADDRESS,
        date:            dateStr,
        timeSlot,
        patientId,
        serviceId:       service.serviceId,
        serviceName:     service.serviceName,
        serviceDuration: service.serviceDuration,
        status,
        createdAt,
        updatedAt:       admin.firestore.Timestamp.fromDate(new Date(createdAt)),
    };
}

// ── SEED ─────────────────────────────────────────────────────
async function seed() {
    const dates = getDatesForLastMonth();
    let totalAdded  = 0;
    let patientIndex = 1;

    for (const dateStr of dates) {
        console.log(`\nSeeding date: ${dateStr}`);

        for (const timeSlot of TIME_SLOTS) {
            // 1–3 appointments per slot — clinics aren't always full
            const count = randomInt(1, 3);

            for (let i = 0; i < count; i++) {
                const appointment = buildAppointment(dateStr, timeSlot, patientIndex);

                await db.collection("appointments").add(appointment);

                totalAdded++;
                patientIndex++;

                const name = PATIENT_NAMES[(patientIndex - 1) % PATIENT_NAMES.length];
                console.log(
                    `  ✓ ${timeSlot} — ${appointment.patientId} (${name}) ` +
                    `[${appointment.status}] — ${appointment.serviceName}`
                );
            }
        }
    }

    console.log(`\n✅ Done. Added ${totalAdded} appointments across ${dates.length} days.`);
    process.exit(0);
}

seed().catch(err => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
});