import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import inventoryRoutes from "./routes/inventory.js";


const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));


app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/auth", authRoutes);
app.use("/inventory", inventoryRoutes);


const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API listening on :${port}`));