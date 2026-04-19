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

module.exports = { verifyToken, requireRole };
