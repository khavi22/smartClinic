const axios = require("axios");
const { updateClinicOperatingHours, ensureClinicExists, getClinicServices, addClinicService, updateClinicService, deleteClinicService, serviceExists } = require("../services/firebaseService");
const { admin, db } = require("../services/config/firebase");

// ── OPERATING HOURS ─────────────────────────────────────────
exports.updateClinicHoursController = async (req, res) => {
  try {
    console.log("Update clinic hours - Request body:", req.body);
    console.log("Update clinic hours - Auth header:", req.headers.authorization ? "Present" : "Missing");
    
    const { clinicId, operatingHours } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("Missing or invalid Authorization header");
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    let decodedToken;

    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
      console.log("Token verified, uid:", decodedToken.uid);
    } catch (authError) {
      console.log("Token verification failed:", authError.message);
      return res.status(401).json({ success: false, message: "Unauthorized: Invalid token" });
    }

    const uid = decodedToken.uid;

    if (!clinicId || !operatingHours) {
      console.log("Missing clinicId or operatingHours");
      return res.status(400).json({ success: false, message: "Missing clinicId or operatingHours" });
    }

    const clinicDoc = await db.collection("clinics").doc(clinicId).get();
    if (!clinicDoc.exists) {
      console.log("Clinic not found:", clinicId);
      return res.status(404).json({ success: false, message: "Clinic not found" });
    }

    if (clinicDoc.data().adminUid !== uid) {
      console.log("User is not the admin of this clinic");
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    await updateClinicOperatingHours(clinicId, operatingHours);
    console.log("Operating hours updated successfully for clinic:", clinicId);
    res.json({ success: true, message: "Operating hours updated successfully" });

  } catch (error) {
    console.error("Error updating clinic hours:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET CLINICS ─────────────────────────────────────────────
exports.getClinics = async (req, res) => {
  const searchName = req.query.search;
  const latitude = req.query.lat;
  const longitude = req.query.lon;
  let Query;

  if (searchName) Query = `clinic named ${searchName} in South Africa`;
  if (latitude && longitude) Query = `clinic near ${latitude},${longitude} in South Africa`;

  try {
    const response = await axios.post(
      "https://places.googleapis.com/v1/places:searchText",
      { textQuery: Query },
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

// ── ENSURE CLINIC EXISTS ────────────────────────────────────
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

// ── SERVICE TEMPLATES ───────────────────────────────────────
exports.getServiceTemplates = async (req, res) => {
  try {
    const templates = await db.collection("serviceTemplates").get();
    const data = templates.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(data);
  } catch (error) {
    console.error("Get templates error:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.seedServiceTemplates = async (req, res) => {
  try {
    const existing = await db.collection("serviceTemplates").limit(1).get();
    if (!existing.empty) {
      return res.status(200).json({ success: true, message: "Already seeded" });
    }
    // Run the seed script manually instead — this route is just a safety check
    res.status(200).json({ success: true, message: "Use node scripts/seedServiceTemplates.js to seed" });
  } catch (error) {
    console.error("Seed error:", error);
    res.status(500).json({ error: error.message });
  }
};

// ── CLINIC SERVICES ─────────────────────────────────────────
exports.getServices = async (req, res) => {
  try {
    let clinicId = req.query.clinicId || (req.user && req.user.clinicId);
    
    // Optional Auth: if no clinicId, try decoding authorization header
    if (!clinicId) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split("Bearer ")[1];
        try {
          const decoded = await admin.auth().verifyIdToken(token);
          const clinicSnapshot = await db
            .collection("clinics")
            .where("adminUid", "==", decoded.uid)
            .limit(1)
            .get();

          if (!clinicSnapshot.empty) {
            clinicId = clinicSnapshot.docs[0].id;
          }
        } catch (authErr) {
          console.warn("Optional auth decoding failed in getServices:", authErr.message);
        }
      }
    }
    
    if (!clinicId) {
      return res.status(400).json({ error: "clinicId is required as query parameter or from user token" });
    }
    
    const services = await getClinicServices(clinicId);
    res.json(services);
  } catch (err) {
    console.error("getServices error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.addService = async (req, res) => {
  try {
    const clinicId = req.user.clinicId;
    if (!clinicId) return res.status(400).json({ error: "No clinicId on token" });

    const { name, description, duration } = req.body;
    if (!name || !description || !duration || duration < 1) {
      return res.status(400).json({ error: "name, description and duration are required" });
    }

    const exists = await serviceExists(clinicId, name);
    if (exists) return res.status(409).json({ error: "A service with that name already exists" });

    const id = await addClinicService(clinicId, { name, description, duration });
    res.status(201).json({ message: "Service added", id });
  } catch (err) {
    console.error("addService error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateService = async (req, res) => {
  try {
    const clinicId = req.user.clinicId;
    if (!clinicId) return res.status(400).json({ error: "No clinicId on token" });
    await updateClinicService(clinicId, req.params.serviceId, req.body);
    res.json({ message: "Updated" });
  } catch (err) {
    console.error("updateService error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteService = async (req, res) => {
  try {
    const clinicId = req.user.clinicId;
    if (!clinicId) return res.status(400).json({ error: "No clinicId on token" });
    await deleteClinicService(clinicId, req.params.serviceId);
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("deleteService error:", err);
    res.status(500).json({ error: err.message });
  }
};