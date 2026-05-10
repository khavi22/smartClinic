const axios = require('axios');
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

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