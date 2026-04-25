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
const seedServiceTemplates = async (req, res) => {
    try {
        const result = await firebaseService.seedServiceTemplates();

        return res.status(200).json({
            success: true,
            message: result.message
        });

    } catch (error) {
        console.error("Seed error:", error);

        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
const getServiceTemplates = async (req, res) => {
    try {
        const templates = await firebaseService.db
            .collection("serviceTemplates")
            .get();

        const data = templates.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return res.status(200).json(data);

    } catch (error) {
        console.error("Fetch templates error:", error);

        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
const firebaseService = require("../services/firebaseService");

// GET services
const getServices = async (req, res) => {
  const clinicId = req.user.clinicId;

  const services = await firebaseService.getClinicServices(clinicId);
  res.json(services);
};


const addService = async (req, res) => {
  const clinicId = req.user.clinicId;

  const id = await firebaseService.addClinicService(clinicId, req.body);

  res.json({ message: "Service added", id });
};


const updateService = async (req, res) => {
  const clinicId = req.user.clinicId;

  await firebaseService.updateClinicService(
    clinicId,
    req.params.serviceId,
    req.body
  );

  res.json({ message: "Updated" });
};


const deleteService = async (req, res) => {
  const clinicId = req.user.clinicId;

  await firebaseService.deleteClinicService(
    clinicId,
    req.params.serviceId
  );

  res.json({ message: "Deleted" });
};