const axios = require('axios');

const GOOGLE_API_KEY = "AIzaSyAKqDTfRFmKVJw2W3PQDGyIgcm_BVpeWBk";

exports.searchClinics = async (query) => {
    const response = await axios.post(
        "https://places.googleapis.com/v1/places:searchText",
        { textQuery: query },
        {
            headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": GOOGLE_API_KEY,
                "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.id"
            }
        }
    );

    return response.data.places || [];
};