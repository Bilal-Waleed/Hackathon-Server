import jwt from "jsonwebtoken";
import User from "../models/userModel.js";

const adminMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization.split(" ")[1];
        if (!token) {
            return res.status(401).json({ message: "No token provided" });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded._id).select("isAdmin");
        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }

        if (!user.isAdmin) {
            return res.status(403).json({ message: "Admin Access denied" });
        }
        req.user = user;
        next();
    } catch (error) {
        console.error("Error in isAdminMiddleware:", error.message, error.name);
        if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
        return res.status(401).json({ error: true, message: "Invalid or expired token" });
        }
        if (error.name === 'MongoNetworkError' || error.message.includes('getaddrinfo ENOTFOUND')) {
        return res.status(503).json({ error: true, message: "Database connection failed. Please check your internet." });
        }
        return res.status(500).json({ error: true, message: "Server error", details: error.message });
    }
};

export default adminMiddleware;