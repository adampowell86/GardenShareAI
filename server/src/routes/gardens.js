import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { parseLimit, parseOffset } from "../lib/pagination.js";
import { gardenCreateSchema, gardenUpdateSchema } from "../validation/schemas.js";

const router = Router();
router.use(requireAuth);

function normalizeGardenInput(input = {}) {
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
    const limit = parseLimit(req.query.limit, { defaultLimit: 50, max: 200 });
    const offset = parseOffset(req.query.offset);
    const gardens = await prisma.garden.findMany({
      where: { userId: req.user.id },
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
    });
    res.json(gardens);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = gardenCreateSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const data = normalizeGardenInput(parsed.data);
    const garden = await prisma.garden.create({
      data: { ...data, userId: req.user.id },
    });
    res.status(201).json(garden);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const parsed = gardenUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const data = normalizeGardenInput(parsed.data);
    const id = req.params.id;
    const existing = await prisma.garden.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user.id) {
      return res.status(404).json({ error: "Garden not found" });
    }
    const updated = await prisma.garden.update({
      where: { id },
      data,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const existing = await prisma.garden.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.user.id) {
      return res.status(404).json({ error: "Garden not found" });
    }
    await prisma.garden.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
