const axios = require('axios');
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { db, admin } = require("./config/firebase");
const { v4: uuidv4 } = require("uuid");


const GOOGLE_API_KEY = defineSecret("GOOGLE_API_KEY");


exports.searchClinics = async (query) => {
    const response = await axios.post(
        "https://places.googleapis.com/v1/places:searchText",
        { textQuery: query },
        {
            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": GOOGLE_API_KEY.value(),
                "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.id"
            }
        }
    );


    return response.data.places || [];
};

exports.updateClinicSlotCapacity = async (clinicId, slotCapacity) => {
    try {
        if (!clinicId || clinicId === "default") {
            throw new Error("Invalid clinic ID.");
        }

        if (!Number.isInteger(slotCapacity) || slotCapacity < 1) {
            throw new Error("Slot capacity must be a positive integer.");
        }

        const clinicRef = db.collection("clinics").doc(clinicId);
        const clinicDoc = await clinicRef.get();

        if (!clinicDoc.exists) {
            throw new Error("Clinic not found.");
        }

        await clinicRef.update({
            slotCapacity,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { clinicId, slotCapacity };
    } catch (error) {
        console.error("Error updating slot capacity:", error);
        throw error;
    }
};