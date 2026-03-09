import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { parseLimit, parseOffset } from "../lib/pagination.js";
import { haveCreateSchema, haveUpdateSchema } from "../validation/schemas.js";

const router = Router();
router.use(requireAuth);

async function ensurePlant(plantId) {
  if (!plantId) return null;
  const plant = await prisma.plant.findUnique({ where: { id: plantId } });
  if (!plant) {
    const error = new Error("Plant not found");
    error.status = 400;
    throw error;
  }
  return plant;
}

// Create HAVE item
router.post("/have", async (req, res, next) => {
  try {
    const parsed = haveCreateSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });
    const { name, qty, notes, plantId } = parsed.data;
    await ensurePlant(plantId);
    const item = await prisma.inventoryItem.create({
      data: { name, qty, notes, plantId, status: "HAVE", userId: req.user.id },
      include: { plant: true },
    });
    return res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

// Create NEED item
router.post("/need", async (req, res, next) => {
  try {
    const parsed = haveCreateSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });
    const { name, qty, notes, plantId } = parsed.data;
    await ensurePlant(plantId);
    const item = await prisma.inventoryItem.create({
      data: { name, qty, notes, plantId, status: "NEED", userId: req.user.id },
      include: { plant: true },
    });
    return res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

// List items (optionally filtered by status)
router.get("/", async (req, res, next) => {
  try {
    const statusFilter = req.query.status
      ? req.query.status.toUpperCase()
      : null;
    const limit = parseLimit(req.query.limit, { defaultLimit: 50, max: 200 });
    const offset = parseOffset(req.query.offset);
    const where = { userId: req.user.id, qty: { gt: 0 } };
    if (statusFilter) where.status = statusFilter;
    const items = await prisma.inventoryItem.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: { plant: true },
      take: limit,
      skip: offset,
    });
    return res.json(items);
  } catch (err) {
    next(err);
  }
});

// Update by id (works for HAVE or NEED)
router.put("/:id", async (req, res, next) => {
  try {
    const parsed = haveUpdateSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.flatten() });
    const id = req.params.id;
    const existing = await prisma.inventoryItem.findUnique({
      where: { id },
    });
    if (!existing || existing.userId !== req.user.id)
      return res.status(404).json({ error: "Not found" });
    await ensurePlant(parsed.data.plantId);
    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: parsed.data,
      include: { plant: true },
    });
    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

// (Optional) Delete an item by id
router.delete("/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    const existing = await prisma.inventoryItem.findUnique({
      where: { id },
    });
    if (!existing || existing.userId !== req.user.id)
      return res.status(404).json({ error: "Not found" });
    await prisma.inventoryItem.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
