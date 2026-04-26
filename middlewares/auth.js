const { admin } = require("../services/config/firebase");

/**
 * Middleware to verify Firebase ID Token
 */
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
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    // clinicId must be stored as a custom claim when the clinic is created
    req.user = {
      uid: decoded.uid,
      clinicId: decoded.clinicId, // set this custom claim at clinic creation time
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


/**
 * Middleware to restrict access by role
 * Assumes verifyToken has already run
 */
const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user || req.user.role !== role) {
            return res.status(403).json({ 
                error: `Access denied. Role '${role}' required.` 
            });
        }
        next();
    };
};

module.exports = { verifyToken, requireRole,authMiddleware, requireAdmin };
