const axios = require("axios");

exports.getClinics = async (req, res) => {
  const searchName = req.query.search;
  const latitude = req.query.lat;
  const longitude = req.query.lon;
  let Query;

  ///search name exits checking if it has a value
  if (searchName) {
    Query = `clinic named ${searchName}`;
  }
  //check if latitude and longitude exist if the patient search using location
  else if (latitude && longitude) {
    Query = `clinic near ${latitude},${longitude}`
  }
  try {
    const response = await axios.post(
      "https://places.googleapis.com/v1/places:searchText",
      {
        textQuery: Query
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key":"AIzaSyAKqDTfRFmKVJw2W3PQDGyIgcm_BVpeWBk",
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