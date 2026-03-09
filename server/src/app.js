import "./env.js";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import inventoryRoutes from "./routes/inventory.js";
import matchingRoutes from "./routes/matching.js";
import tradesRoutes from "./routes/trades.js";
import timingRoutes from "./routes/timing.js";
import usersRoutes from "./routes/users.js";
import gardensRoutes from "./routes/gardens.js";
import plantsRoutes from "./routes/plants.js";
import geoRoutes from "./routes/geo.js";
import { csrfProtection } from "./middleware/csrf.js";

const clientOrigin = process.env.CLIENT_ORIGIN;
if (!clientOrigin) {
  throw new Error("Missing CLIENT_ORIGIN; set it in server/.env");
}

if (!process.env.JWT_SECRET) {
  throw new Error("Missing JWT_SECRET; set it in server/.env");
}

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(
  cors({
    origin: clientOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  })
);

app.use(csrfProtection);

// Simple health-check endpoint
app.get("/health", (_req, res) => res.json({ ok: true }));

// Route registration
app.use("/auth", authRoutes);
app.use("/inventory", inventoryRoutes);
app.use("/matching", matchingRoutes);
app.use("/trades", tradesRoutes);
app.use("/timing", timingRoutes);
app.use("/users", usersRoutes);
app.use("/gardens", gardensRoutes);
app.use("/plants", plantsRoutes);
app.use("/geo", geoRoutes);

// Centralized error handler so async errors do not crash the process
app.use((err, _req, res, _next) => {
  console.error(err);
  if (res.headersSent) return;
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  const status = err.status || err.statusCode || 500;
  const message = status >= 500 ? "Internal server error" : err.message || "Request failed";
  return res.status(status).json({ error: message });
});

export default app;
