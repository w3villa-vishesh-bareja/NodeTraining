import { verifyToken } from "../config/db.js";

export const verifyJwt = async (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized: Missing or invalid token format" });
  }

  try {
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(400).json({ message: "Bad request: Token is missing" });
    }
    const decoded = await verifyToken(token);
    console.log(decoded);
    if (!decoded) {
      return res.status(403).json({ message: "Unauthasdadorized: Invalid token" });
    }
    req.user = decoded;
    console.log("User after decoding:", req.user);
    next();
  } catch (err) {
    console.error("Error during token verification:", err.message);
    return res.status(403).json({ message: "Unauthorized: Invalid token" });
  }
};
