// Usage: node scripts/seedServiceTemplates.js

require('dotenv').config();
const { admin } = require('../services/config/firebase');

const db = admin.firestore();

const templates = [
    { name: "General Consultation", description: "Initial consultation with a general practitioner", duration: 30 },
    { name: "Dental Cleaning", description: "Professional teeth cleaning and examination", duration: 45 },
    { name: "Physical Therapy Session", description: "One-on-one physical therapy treatment", duration: 60 },
    { name: "Blood Test", description: "Routine blood work and laboratory analysis", duration: 15 },
    { name: "X-Ray Imaging", description: "Digital X-ray examination", duration: 20 },
    { name: "Vaccination", description: "Immunization and vaccine administration", duration: 15 },
    { name: "Eye Examination", description: "Comprehensive vision and eye health check", duration: 40 },
    { name: "Dermatology Consultation", description: "Skin condition assessment and treatment", duration: 35 },
    { name: "Cardiology Consultation", description: "Heart health assessment and consultation", duration: 50 },
    { name: "Pediatric Check-up", description: "Routine wellness exam for children", duration: 30 },
    { name: "Mental Health Counseling", description: "Therapy session with mental health professional", duration: 60 },
    { name: "Nutrition Consultation", description: "Dietary assessment and nutrition planning", duration: 45 },
    { name: "Ultrasound", description: "Diagnostic ultrasound imaging", duration: 30 },
    { name: "ECG/EKG", description: "Electrocardiogram heart monitoring", duration: 20 },
    { name: "Allergy Testing", description: "Comprehensive allergy screening", duration: 60 },
    { name: "Minor Surgery", description: "Outpatient surgical procedure", duration: 90 },
    { name: "Physiotherapy", description: "Physical rehabilitation therapy", duration: 45 },
    { name: "Diabetes Management", description: "Blood sugar monitoring and consultation", duration: 30 },
    { name: "Prenatal Check-up", description: "Routine pregnancy health monitoring", duration: 40 },
    { name: "Occupational Therapy", description: "Daily living skills rehabilitation", duration: 60 },
];

const seedServiceTemplates = async () => {
    console.log("\nChecking if service templates already exist...\n");

    const existing = await db.collection("serviceTemplates").limit(1).get();

    if (!existing.empty) {
        console.log("✓ serviceTemplates already seeded. Nothing to do.\n");
        return; // ← return instead of process.exit so it never kills the server if imported
    }

    console.log(`Seeding ${templates.length} service templates...\n`);

    const batch = db.batch();

    templates.forEach(template => {
        const ref = db.collection("serviceTemplates").doc();
        batch.set(ref, {
            ...template,
            createdAt: new Date().toISOString(),
        });
    });

    await batch.commit();

    console.log(`✓ Successfully seeded ${templates.length} service templates.\n`);
};

seedServiceTemplates()
    .then(() => {
        console.log("Done.");
        process.exit(0);
    })
    .catch((err) => {
        console.error("Seeding failed:", err.message);
        process.exit(1);
    });