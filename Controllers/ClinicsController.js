const axios = require("axios");

exports.getClinics = async (req, res) => {
  console.log(process.env.GOOGLE_MAPS_API_KEY);
  const searchName=req.query.search;
  const latitude = req.query.lat;
  const longitude = req.query.lon;
  let  Query;

  ///search name exits checking if it has a value
  if(searchName){
    Query = `${searchName} clinics in Johannesburg South Africa`;
  }
  //check if latitude and longitude exist if the patient search using location
  if(latitude &&  longitude){
    Query =`clinic near ${latitude},${longitude} in Johannesburg South Africa`
  }
  console.log(process.env.GOOGLE_MAPS_API_KEY);
  try {
    const response = await axios.post(
      "https://places.googleapis.com/v1/places:searchText",
      {
        textQuery:Query 
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