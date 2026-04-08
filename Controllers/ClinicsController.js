const axios = require("axios");

exports.getClinics = async (req, res) => {
  try {
    const response = await axios.post(
      "https://places.googleapis.com/v1/places:searchText",
      {
        textQuery: "clinics in Johannesburg, South Africa"
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY,
          "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.id"
        }
      }
    );

    res.json(response.data);
  } catch (err) {
    console.error("Google Places error:", err.response?.data || err.message);
    res.status(500).json({ error: "Error fetching clinics" });
  }
};