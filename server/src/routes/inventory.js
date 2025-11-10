import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { haveCreateSchema, haveUpdateSchema } from "../validation/schemas.js";


const router = Router();
router.use(requireAuth);


// Create HAVE item
router.post("/have", async (req, res) => {
const parsed = haveCreateSchema.safeParse(req.body);
if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
const { name, qty, notes } = parsed.data;
const item = await prisma.inventoryItem.create({
data: { name, qty, notes, status: "HAVE", userId: req.user.id }
});
return res.status(201).json(item);
});


// List items (Week 2: all HAVE for the user)
router.get("/", async (req, res) => {
const items = await prisma.inventoryItem.findMany({
where: { userId: req.user.id },
orderBy: { updatedAt: "desc" }
});
return res.json(items);
});


// Update by id
router.put("/:id", async (req, res) => {
const parsed = haveUpdateSchema.safeParse(req.body);
if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
const id = req.params.id;
// ownership check
const existing = await prisma.inventoryItem.findUnique({ where: { id } });
if (!existing || existing.userId !== req.user.id) return res.status(404).json({ error: "Not found" });
const updated = await prisma.inventoryItem.update({ where: { id }, data: parsed.data });
return res.json(updated);
});


export default router;