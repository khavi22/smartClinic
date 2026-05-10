const { admin } = require("../services/config/firebase");
const db = admin.firestore();

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);

    // Find the clinic where this admin is the owner
    const clinicSnapshot = await db
      .collection("clinics")
      .where("adminUid", "==", decoded.uid)
      .limit(1)
      .get();

    if (clinicSnapshot.empty) {
      return res.status(403).json({ error: "No clinic linked to this admin account" });
    }

    const clinicDoc = clinicSnapshot.docs[0];

    req.user = {
      uid: decoded.uid,
      clinicId: clinicDoc.id,
      isAdmin: true,
    };

    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  const idToken = authHeader.split(" ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Token verification failed:", error);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

const requireRole = (role) => {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: `Access denied. Role '${role}' required.` });
    }
    next();
  };
};

module.exports = { verifyToken, requireRole, authMiddleware, requireAdmin };