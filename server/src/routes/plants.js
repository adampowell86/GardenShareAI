import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { parseLimit, parseOffset } from "../lib/pagination.js";
import { plantCreateSchema, plantUpdateSchema } from "../validation/schemas.js";

const router = Router();
router.use(requireAuth);

function normalizePlantInput(input = {}) {
  const cleaned = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      cleaned[key] = trimmed === "" ? null : trimmed;
      continue;
    }
    if (typeof value === "number") {
      cleaned[key] = value;
      continue;
    }
    if (value === null) {
      cleaned[key] = null;
    }
  }
  return cleaned;
}

router.get("/", async (req, res, next) => {
  try {
    const q = req.query.q ? String(req.query.q).trim() : "";
    const limit = parseLimit(req.query.limit, { defaultLimit: 100, max: 300 });
    const offset = parseOffset(req.query.offset);
    const where = q
      ? {
          OR: [
            { commonName: { contains: q, mode: "insensitive" } },
            { tags: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined;
    const plants = await prisma.plant.findMany({
      where,
      orderBy: { commonName: "asc" },
      take: limit,
      skip: offset,
    });
    res.json(plants);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = plantCreateSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const data = normalizePlantInput(parsed.data);
    const plant = await prisma.plant.create({ data });
    res.status(201).json(plant);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const parsed = plantUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const data = normalizePlantInput(parsed.data);
    const id = req.params.id;
    const existing = await prisma.plant.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Plant not found" });
    const updated = await prisma.plant.update({ where: { id }, data });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const existing = await prisma.plant.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Plant not found" });
    await prisma.inventoryItem.updateMany({
      where: { plantId: id },
      data: { plantId: null },
    });
    await prisma.plant.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
