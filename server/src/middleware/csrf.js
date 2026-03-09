import crypto from "crypto";
import { csrfCookieOptions } from "../lib/cookies.js";

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function generateToken() {
  return crypto.randomBytes(24).toString("hex");
}

export function csrfProtection(req, res, next) {
  if (process.env.CSRF_DISABLED === "true") {
    return next();
  }

  let token = req.cookies?.[CSRF_COOKIE];
  if (!token) {
    token = generateToken();
    res.cookie(CSRF_COOKIE, token, csrfCookieOptions());
    if (!req.cookies) req.cookies = {};
    req.cookies[CSRF_COOKIE] = token;
  }

  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const headerToken = req.get(CSRF_HEADER);
  if (!headerToken || headerToken !== token) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  return next();
}
