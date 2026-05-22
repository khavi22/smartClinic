// const {admin } = require("../../services/config/firebase");

require("dotenv").config();
const admin = require("firebase-admin");

const serviceAccount = JSON.parse(process.env.FIREBASE_CREDENTIALS_JSON);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

const mockAppointments = [
    {
        clinicAddress: "51 Klein St, Hillbrow, Johannesburg, 2017, South Africa",
        clinicId: "ChIJExgRGs4NIR4RMcO4P5F8umc",
        clinicName: "Hillbrow Clinic",
        createdAt: new Date().toISOString(),
        date: "2026-05-19",
        patientId: "5NYBO0BsuWgha20rRtGAAzgBJe03",
        serviceDuration: 30,
        serviceId: "undefined",
        serviceName: "General Outpatient Consultation",
        status: "cancelled",
        timeSlot: "00:00 - 01:00",
        updatedAt: new Date()
    },
    {
        clinicAddress: "51 Klein St, Hillbrow, Johannesburg, 2017, South Africa",
        clinicId: "ChIJExgRGs4NIR4RMcO4P5F8umc",
        clinicName: "Hillbrow Clinic",
        createdAt: new Date().toISOString(),
        date: "2026-05-19",
        patientId: "patient_002",
        serviceDuration: 30,
        serviceId: "undefined",
        serviceName: "General Outpatient Consultation",
        status: "booked",
        timeSlot: "01:00 - 02:00",
        updatedAt: new Date()
    },
    {
        clinicAddress: "51 Klein St, Hillbrow, Johannesburg, 2017, South Africa",
        clinicId: "ChIJExgRGs4NIR4RMcO4P5F8umc",
        clinicName: "Hillbrow Clinic",
        createdAt: new Date().toISOString(),
        date: "2026-05-19",
        patientId: "patient_003",
        serviceDuration: 30,
        serviceId: "undefined",
        serviceName: "General Outpatient Consultation",
        status: "completed",
        timeSlot: "02:00 - 03:00",
        updatedAt: new Date()
    },
    {
        clinicAddress: "51 Klein St, Hillbrow, Johannesburg, 2017, South Africa",
        clinicId: "ChIJExgRGs4NIR4RMcO4P5F8umc",
        clinicName: "Hillbrow Clinic",
        createdAt: new Date().toISOString(),
        date: "2026-05-19",
        patientId: "patient_004",
        serviceDuration: 30,
        serviceId: "undefined",
        serviceName: "General Outpatient Consultation",
        status: "pending",
        timeSlot: "03:00 - 04:00",
        updatedAt: new Date()
    },
    {
        clinicAddress: "51 Klein St, Hillbrow, Johannesburg, 2017, South Africa",
        clinicId: "ChIJExgRGs4NIR4RMcO4P5F8umc",
        clinicName: "Hillbrow Clinic",
        createdAt: new Date().toISOString(),
        date: "2026-05-19",
        patientId: "patient_005",
        serviceDuration: 30,
        serviceId: "undefined",
        serviceName: "General Outpatient Consultation",
        status: "cancelled",
        timeSlot: "04:00 - 05:00",
        updatedAt: new Date()
    },
    {
        clinicAddress: "51 Klein St, Hillbrow, Johannesburg, 2017, South Africa",
        clinicId: "ChIJExgRGs4NIR4RMcO4P5F8umc",
        clinicName: "Hillbrow Clinic",
        createdAt: new Date().toISOString(),
        date: "2026-05-19",
        patientId: "patient_006",
        serviceDuration: 30,
        serviceId: "undefined",
        serviceName: "General Outpatient Consultation",
        status: "booked",
        timeSlot: "05:00 - 06:00",
        updatedAt: new Date()
    },
    {
        clinicAddress: "51 Klein St, Hillbrow, Johannesburg, 2017, South Africa",
        clinicId: "ChIJExgRGs4NIR4RMcO4P5F8umc",
        clinicName: "Hillbrow Clinic",
        createdAt: new Date().toISOString(),
        date: "2026-05-19",
        patientId: "patient_007",
        serviceDuration: 30,
        serviceId: "undefined",
        serviceName: "General Outpatient Consultation",
        status: "completed",
        timeSlot: "06:00 - 07:00",
        updatedAt: new Date()
    },
    {
        clinicAddress: "51 Klein St, Hillbrow, Johannesburg, 2017, South Africa",
        clinicId: "ChIJExgRGs4NIR4RMcO4P5F8umc",
        clinicName: "Hillbrow Clinic",
        createdAt: new Date().toISOString(),
        date: "2026-05-19",
        patientId: "patient_008",
        serviceDuration: 30,
        serviceId: "undefined",
        serviceName: "General Outpatient Consultation",
        status: "pending",
        timeSlot: "07:00 - 08:00",
        updatedAt: new Date()
    },
    {
        clinicAddress: "51 Klein St, Hillbrow, Johannesburg, 2017, South Africa",
        clinicId: "ChIJExgRGs4NIR4RMcO4P5F8umc",
        clinicName: "Hillbrow Clinic",
        createdAt: new Date().toISOString(),
        date: "2026-05-19",
        patientId: "patient_009",
        serviceDuration: 30,
        serviceId: "undefined",
        serviceName: "General Outpatient Consultation",
        status: "cancelled",
        timeSlot: "08:00 - 09:00",
        updatedAt: new Date()
    },
    {
        clinicAddress: "51 Klein St, Hillbrow, Johannesburg, 2017, South Africa",
        clinicId: "ChIJExgRGs4NIR4RMcO4P5F8umc",
        clinicName: "Hillbrow Clinic",
        createdAt: new Date().toISOString(),
        date: "2026-05-19",
        patientId: "patient_010",
        serviceDuration: 30,
        serviceId: "undefined",
        serviceName: "General Outpatient Consultation",
        status: "booked",
        timeSlot: "09:00 - 10:00",
        updatedAt: new Date()
    },
    {
        clinicAddress: "51 Klein St, Hillbrow, Johannesburg, 2017, South Africa",
        clinicId: "ChIJExgRGs4NIR4RMcO4P5F8umc",
        clinicName: "Hillbrow Clinic",
        createdAt: new Date().toISOString(),
        date: "2026-05-19",
        patientId: "patient_011",
        serviceDuration: 30,
        serviceId: "undefined",
        serviceName: "General Outpatient Consultation",
        status: "completed",
        timeSlot: "10:00 - 11:00",
        updatedAt: new Date()
    },
    {
        clinicAddress: "51 Klein St, Hillbrow, Johannesburg, 2017, South Africa",
        clinicId: "ChIJExgRGs4NIR4RMcO4P5F8umc",
        clinicName: "Hillbrow Clinic",
        createdAt: new Date().toISOString(),
        date: "2026-05-19",
        patientId: "patient_012",
        serviceDuration: 30,
        serviceId: "undefined",
        serviceName: "General Outpatient Consultation",
        status: "pending",
        timeSlot: "11:00 - 12:00",
        updatedAt: new Date()
    },
    {
        clinicAddress: "51 Klein St, Hillbrow, Johannesburg, 2017, South Africa",
        clinicId: "ChIJExgRGs4NIR4RMcO4P5F8umc",
        clinicName: "Hillbrow Clinic",
        createdAt: new Date().toISOString(),
        date: "2026-05-19",
        patientId: "patient_013",
        serviceDuration: 30,
        serviceId: "undefined",
        serviceName: "General Outpatient Consultation",
        status: "cancelled",
        timeSlot: "12:00 - 13:00",
        updatedAt: new Date()
    },
    {
        clinicAddress: "51 Klein St, Hillbrow, Johannesburg, 2017, South Africa",
        clinicId: "ChIJExgRGs4NIR4RMcO4P5F8umc",
        clinicName: "Hillbrow Clinic",
        createdAt: new Date().toISOString(),
        date: "2026-05-19",
        patientId: "patient_014",
        serviceDuration: 30,
        serviceId: "undefined",
        serviceName: "General Outpatient Consultation",
        status: "booked",
        timeSlot: "13:00 - 14:00",
        updatedAt: new Date()
    },
    {
        clinicAddress: "51 Klein St, Hillbrow, Johannesburg, 2017, South Africa",
        clinicId: "ChIJExgRGs4NIR4RMcO4P5F8umc",
        clinicName: "Hillbrow Clinic",
        createdAt: new Date().toISOString(),
        date: "2026-05-19",
        patientId: "patient_015",
        serviceDuration: 30,
        serviceId: "undefined",
        serviceName: "General Outpatient Consultation",
        status: "completed",
        timeSlot: "14:00 - 15:00",
        updatedAt: new Date()
    },
    {
        clinicAddress: "51 Klein St, Hillbrow, Johannesburg, 2017, South Africa",
        clinicId: "ChIJExgRGs4NIR4RMcO4P5F8umc",
        clinicName: "Hillbrow Clinic",
        createdAt: new Date().toISOString(),
        date: "2026-05-19",
        patientId: "patient_016",
        serviceDuration: 30,
        serviceId: "undefined",
        serviceName: "General Outpatient Consultation",
        status: "pending",
        timeSlot: "15:00 - 16:00",
        updatedAt: new Date()
    },
    {
        clinicAddress: "51 Klein St, Hillbrow, Johannesburg, 2017, South Africa",
        clinicId: "ChIJExgRGs4NIR4RMcO4P5F8umc",
        clinicName: "Hillbrow Clinic",
        createdAt: new Date().toISOString(),
        date: "2026-05-19",
        patientId: "patient_017",
        serviceDuration: 30,
        serviceId: "undefined",
        serviceName: "General Outpatient Consultation",
        status: "cancelled",
        timeSlot: "16:00 - 17:00",
        updatedAt: new Date()
    },
    {
        clinicAddress: "51 Klein St, Hillbrow, Johannesburg, 2017, South Africa",
        clinicId: "ChIJExgRGs4NIR4RMcO4P5F8umc",
        clinicName: "Hillbrow Clinic",
        createdAt: new Date().toISOString(),
        date: "2026-05-19",
        patientId: "patient_018",
        serviceDuration: 30,
        serviceId: "undefined",
        serviceName: "General Outpatient Consultation",
        status: "booked",
        timeSlot: "17:00 - 18:00",
        updatedAt: new Date()
    },
    {
        clinicAddress: "51 Klein St, Hillbrow, Johannesburg, 2017, South Africa",
        clinicId: "ChIJExgRGs4NIR4RMcO4P5F8umc",
        clinicName: "Hillbrow Clinic",
        createdAt: new Date().toISOString(),
        date: "2026-05-19",
        patientId: "patient_019",
        serviceDuration: 30,
        serviceId: "undefined",
        serviceName: "General Outpatient Consultation",
        status: "completed",
        timeSlot: "18:00 - 19:00",
        updatedAt: new Date()
    },
    {
        clinicAddress: "51 Klein St, Hillbrow, Johannesburg, 2017, South Africa",
        clinicId: "ChIJExgRGs4NIR4RMcO4P5F8umc",
        clinicName: "Hillbrow Clinic",
        createdAt: new Date().toISOString(),
        date: "2026-05-19",
        patientId: "patient_020",
        serviceDuration: 30,
        serviceId: "undefined",
        serviceName: "General Outpatient Consultation",
        status: "pending",
        timeSlot: "19:00 - 20:00",
        updatedAt: new Date()
    }
];

async function seedAppointments() {
    try {
        const appointmentsRef = db.collection("appointments");

        for (const appointment of mockAppointments) {
            await appointmentsRef.add(appointment);
            console.log("Added:", appointment.patientId);
        }

        console.log("All appointments added");
        process.exit();

    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

seedAppointments();