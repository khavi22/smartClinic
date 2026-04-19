// node scripts/onboardClinic.js "Sunninghill Hospital"

require('dotenv').config();
const clinicService = require('../services/clinicService');
const firebaseService = require('../services/firebaseService');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const ask = (question) => new Promise((resolve) => rl.question(question, resolve));

const onboardClinic = async () => {
    const [,, ...args] = process.argv;
    const searchQuery = args.join(" ");

    if (!searchQuery) {
        console.error("Usage: node scripts/onboardClinic.js <clinic name>");
        process.exit(1);
    }

    console.log(`\nSearching for: "${searchQuery}"...\n`);

    const places = await clinicService.searchClinics(`clinic named ${searchQuery}`);

    if (!places.length) {
        console.log("No clinics found.");
        process.exit(0);
    }

    // Show results
    places.forEach((place, index) => {
        console.log(`[${index + 1}] ${place.displayName.text}`);
        console.log(`    ${place.formattedAddress}`);
        console.log(`    Place ID: ${place.id}\n`);
    });

    // Let the team pick the right one
    const answer = await ask("Enter the number of the clinic to onboard (or 0 to cancel): ");
    const choice = parseInt(answer);

    if (!choice || choice < 1 || choice > places.length) {
        console.log("Cancelled.");
        rl.close();
        process.exit(0);
    }

    const selected = places[choice - 1];
    const clinicName = selected.displayName.text;
    const city = selected.formattedAddress.split(",").slice(-2)[0].trim();
    const placeId = selected.id;

    // Confirm
    const confirm = await ask(`\nOnboard "${clinicName}"? (y/n): `);
    if (confirm.toLowerCase() !== "y") {
        console.log("Cancelled.");
        rl.close();
        process.exit(0);
    }

    const { adminCode } = await firebaseService.createClinic({ placeId, clinicName, city });

    console.log(`\n✓ Clinic onboarded successfully`);
    console.log(`  Clinic   : ${clinicName}`);
    console.log(`  Place ID : ${placeId}`);
    console.log(`  Code     : ${adminCode}`);
    console.log(`\n  Send this code to the clinic's designated admin.\n`);

    rl.close();
};

onboardClinic().catch((err) => {
    console.error("Failed:", err.message);
    process.exit(1);
});