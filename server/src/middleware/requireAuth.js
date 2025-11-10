import jwt from "jsonwebtoken";


export function requireAuth(req, res, next) {
try {
const token = req.cookies?.access_token || (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.split(" ")[1] : null);
if (!token) return res.status(401).json({ error: "Unauthorized" });
const payload = jwt.verify(token, process.env.JWT_SECRET);
req.user = { id: payload.sub, email: payload.email };
next();
} catch (e) {
return res.status(401).json({ error: "Unauthorized" });
}
}