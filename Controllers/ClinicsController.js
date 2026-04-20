const axios = require("axios");
const { updateClinicOperatingHours, ensureClinicExists } = require("../services/firebaseService");
const { admin, db } = require("../services/config/firebase");

exports.updateClinicHoursController = async (req, res) => {
  try {
    const { clinicId, operatingHours } = req.body;
    const authHeader = req.headers.authorization;

    console.log("Update Hours Request:", { clinicId, hasHours: !!operatingHours, hasAuth: !!authHeader });

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Unauthorized: Missing or invalid token" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    let decodedToken;
    
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (authError) {
      console.error("Token verification failed:", authError);
      return res.status(401).json({ success: false, message: "Unauthorized: Invalid token" });
    }

    const uid = decodedToken.uid;
    console.log("Decoded UID:", uid);

    if (!clinicId || !operatingHours) {
      return res.status(400).json({ success: false, message: "Missing clinicId or operatingHours" });
    }

    // Verify ownership: Does this clinic belong to this admin?
    const clinicDoc = await db.collection("clinics").doc(clinicId).get();
    if (!clinicDoc.exists) {
        return res.status(404).json({ success: false, message: "Clinic not found" });
    }

    const clinicData = clinicDoc.data();
    if (clinicData.adminUid !== uid) {
        return res.status(403).json({ success: false, message: "Forbidden: You do not have permission to manage this clinic" });
    }

    await updateClinicOperatingHours(clinicId, operatingHours);

    res.json({
      success: true,
      message: "Operating hours updated successfully",
      clinicId: clinicId
    });
  } catch (error) {
    console.error("Error updating clinic hours:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update operating hours",
      error: error.message
    });
  }
};

exports.getClinics = async (req, res) => {
  const searchName = req.query.search;
  const latitude = req.query.lat;
  const longitude = req.query.lon;
  let Query;

  ///search name exits checking if it has a value
  if (searchName) {
    Query = `clinic named ${searchName} in South Africa`;
  }
  //check if latitude and longitude exist if the patient search using location
  if (latitude && longitude) {
    Query = `clinic near ${latitude},${longitude} in South Africa`
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

exports.ensureClinicExistsController = async (req, res) => {
  try {
    const { clinicId, name, address } = req.body;
    
    if (!clinicId || !name) {
      return res.status(400).json({ success: false, message: "Missing clinicId or name" });
    }

    const result = await ensureClinicExists({ clinicId, name, address });
    res.json(result);
  } catch (error) {
    console.error("Error ensuring clinic exists:", error);
    res.status(500).json({ success: false, message: "Failed to initialize clinic", error: error.message });
  }
};