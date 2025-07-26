import { verifyToken } from "../config/dbService.js";

export const verifyJwt = async (req, res, next) => {
  let token;

  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  console.log("cookie in req",req.cookies)
  // console.log("full req obj",req);
  console.log("full header",req.headers.cookie);
  console.log("full req obj",req.headers.cookie?.token);

  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res
      .status(401)
      .json({ message: "Unauthorized: Token not provided in header or cookie" });
  }

  try {
    const decoded = await verifyToken(token);

    if (!decoded) {
      return res.status(403).json({ message: "Unauthorized: Invalid token" });
    }

    req.user = { ...decoded, token };
    console.log("✅ User after decoding:", req.user);
    next();
  } catch (err) {
    console.error("❌ Error during token verification:", err.message);
    return res.status(403).json({ message: "Unauthorized: Invalid token" });
  }
};
