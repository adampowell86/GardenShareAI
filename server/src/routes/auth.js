import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { prisma } from "../db.js";
import { loginSchema, signupSchema } from "../validation/schemas.js";


const router = Router();


const loginLimiter = rateLimit({
windowMs: 60 * 1000,
max: 5,
standardHeaders: true,
legacyHeaders: false
});


function signTokens(user) {
const accessToken = jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
subject: user.id,
expiresIn: `${process.env.TOKEN_TTL_MINUTES || 15}m`
});
const refreshToken = jwt.sign({ email: user.email, type: "refresh" }, process.env.JWT_SECRET, {
subject: user.id,
expiresIn: `${process.env.REFRESH_TTL_DAYS || 7}d`
});
return { accessToken, refreshToken };
}


router.post("/signup", async (req, res) => {
const parsed = signupSchema.safeParse(req.body);
if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
const { email, password } = parsed.data;
const existing = await prisma.user.findUnique({ where: { email } });
if (existing) return res.status(409).json({ error: "Account already exists" });
const passwordHash = await bcrypt.hash(password, 12);
const user = await prisma.user.create({ data: { email, passwordHash } });
const { accessToken, refreshToken } = signTokens(user);
res
.cookie("access_token", accessToken, { httpOnly: true, sameSite: "lax", secure: false, path: "/" })
.cookie("refresh_token", refreshToken, { httpOnly: true, sameSite: "lax", secure: false, path: "/auth/refresh" })
.status(201)
.json({ id: user.id, email: user.email });
});


router.post("/login", loginLimiter, async (req, res) => {
const parsed = loginSchema.safeParse(req.body);
if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
const { email, password } = parsed.data;
const user = await prisma.user.findUnique({ where: { email } });
if (!user) return res.status(401).json({ error: "Invalid credentials" });
const ok = await bcrypt.compare(password, user.passwordHash);
if (!ok) return res.status(401).json({ error: "Invalid credentials" });
const { accessToken, refreshToken } = signTokens(user);
res
.cookie("access_token", accessToken, { httpOnly: true, sameSite: "lax", secure: false, path: "/" })
.cookie("refresh_token", refreshToken, { httpOnly: true, sameSite: "lax", secure: false, path: "/auth/refresh" })
.json({ id: user.id, email: user.email });
});


router.post("/logout", (req, res) => {
res.clearCookie("access_token", { path: "/" });
res.clearCookie("refresh_token", { path: "/auth/refresh" });
res.json({ ok: true });
});


router.get("/me", (req, res) => {
const token = req.cookies?.access_token;
if (!token) return res.status(401).json({ error: "Unauthorized" });
try {
const payload = jwt.verify(token, process.env.JWT_SECRET);
return res.json({ id: payload.sub, email: payload.email });
} catch {
return res.status(401).json({ error: "Unauthorized" });
}
});


export default router;