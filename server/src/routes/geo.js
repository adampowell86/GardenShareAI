import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { lookupZip } from "../lib/geo.js";

const router = Router();
router.use(requireAuth);

router.get("/lookup", async (req, res, next) => {
  try {
    const zip = req.query.zip ? String(req.query.zip).trim() : "";
    if (!zip) return res.status(400).json({ error: "zip is required" });
    const result = await lookupZip(zip);
    if (!result) return res.status(404).json({ error: "Zip lookup failed" });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
