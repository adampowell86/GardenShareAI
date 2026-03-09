import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { lookupZip } from "../lib/geo.js";
import { profileUpdateSchema } from "../validation/schemas.js";

const router = Router();
router.use(requireAuth);

const PROFILE_FIELDS = {
  id: true,
  email: true,
  name: true,
  displayName: true,
  location: true,
  zip: true,
  radiusKm: true,
  latitude: true,
  longitude: true,
  bio: true,
  interests: true,
  createdAt: true,
};

function normalizeProfileInput(input = {}) {
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

router.get("/me", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: PROFILE_FIELDS,
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const [haveCount, needCount, tradeCount, pendingTradeCount] = await Promise.all([
      prisma.inventoryItem.count({ where: { userId, status: "HAVE", qty: { gt: 0 } } }),
      prisma.inventoryItem.count({ where: { userId, status: "NEED", qty: { gt: 0 } } }),
      prisma.trade.count({ where: { OR: [{ userAId: userId }, { userBId: userId }] } }),
      prisma.trade.count({
        where: {
          status: "PENDING",
          OR: [{ userAId: userId }, { userBId: userId }],
        },
      }),
    ]);

    res.json({
      profile: user,
      stats: { haveCount, needCount, tradeCount, pendingTradeCount },
    });
  } catch (err) {
    next(err);
  }
});

router.put("/me", async (req, res, next) => {
  try {
    const parsed = profileUpdateSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const data = normalizeProfileInput(parsed.data);
    const existing = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { zip: true, latitude: true, longitude: true },
    });
    const zip = data.zip ?? existing?.zip;
    const lat = data.latitude ?? existing?.latitude;
    const lon = data.longitude ?? existing?.longitude;
    let geo = null;
    if (zip && (lat === null || lat === undefined || lon === null || lon === undefined)) {
      const lookup = await lookupZip(zip);
      if (lookup) {
        data.latitude = lat ?? lookup.latitude;
        data.longitude = lon ?? lookup.longitude;
        geo = { ...lookup, applied: true };
      } else {
        geo = { applied: false };
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: PROFILE_FIELDS,
    });

    res.json({ profile: updated, geo });
  } catch (err) {
    next(err);
  }
});

export default router;
