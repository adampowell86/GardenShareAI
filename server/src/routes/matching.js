import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { parseLimit, parseOffset } from "../lib/pagination.js";
import { buildRarityMap, computeScore, distanceKm } from "../lib/matching.js";

const router = Router();
router.use(requireAuth);

function parseMinScore(value, fallback = 25) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  if (parsed < 0) return 0;
  if (parsed > 100) return 100;
  return parsed;
}

function keywordSet(text = "") {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter(Boolean)
  );
}

function tagSet(text = "") {
  if (!text) return new Set();
  return new Set(
    text
      .toLowerCase()
      .split(/[,;/|]+/)
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

function attachMatchCache(item) {
  const name = (item?.name || "").trim();
  const plant = item?.plant || null;
  item.__nameLower = name.toLowerCase();
  item.__keywords = keywordSet(`${name} ${item?.notes || ""} ${plant?.commonName || ""}`);
  item.__tags = tagSet(plant?.tags || "");
  item.__season = plant?.season || null;
  return item;
}

router.get("/suggestions", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = parseLimit(req.query.limit, { defaultLimit: 25, max: 200 });
    const offset = parseOffset(req.query.offset);
    const maxNeeds = parseLimit(req.query.maxNeeds, { defaultLimit: 300, max: 1000 });
    const minScore = parseMinScore(req.query.minScore, 25);

    const [user, haveItems, needItems] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, latitude: true, longitude: true, radiusKm: true, interests: true },
      }),
      prisma.inventoryItem.findMany({
        where: { userId, status: "HAVE", qty: { gt: 0 } },
        include: { plant: true },
      }),
      prisma.inventoryItem.findMany({
        where: { status: "NEED", userId: { not: userId }, qty: { gt: 0 } },
        include: {
          plant: true,
          user: {
            select: {
              id: true,
              latitude: true,
              longitude: true,
              radiusKm: true,
              displayName: true,
              location: true,
              bio: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: maxNeeds,
      }),
    ]);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const preferredRadius = user.radiusKm ?? 25;
    const rarityMap = buildRarityMap(needItems);

    const suggestions = [];
    const distanceCache = new Map();
    const viewerInterests = user.interests || "";

    haveItems.forEach((item) => attachMatchCache(item));
    needItems.forEach((item) => attachMatchCache(item));

    function getDistance(targetUser) {
      if (!targetUser?.id) return null;
      if (distanceCache.has(targetUser.id)) return distanceCache.get(targetUser.id);
      const value = distanceKm(user, targetUser);
      distanceCache.set(targetUser.id, value);
      return value;
    }

    for (const h of haveItems) {
      for (const n of needItems) {
        const targetUser = n.user;
        if (!targetUser) continue;
        const distanceValue = getDistance(targetUser);
        const withinUserRadius =
          typeof distanceValue === "number" ? distanceValue <= preferredRadius : true;
        const withinTargetRadius =
          typeof distanceValue === "number" && targetUser?.radiusKm
            ? distanceValue <= targetUser.radiusKm
            : true;

        if (!withinUserRadius || !withinTargetRadius) continue;

        const { score, reasons, breakdown } = computeScore(h, n, {
          rarityMap,
          distanceKm: distanceValue,
          radiusKm: preferredRadius,
          viewerInterests,
          penalizeMissingDistance: true,
        });
        if (score < minScore) continue;

        const positiveReasons = breakdown
          .filter((b) => b.delta > 0)
          .map((b) => `${b.label}${b.delta ? ` (+${b.delta})` : ""}`);

        suggestions.push({
          haveItemId: h.id,
          haveName: h.name,
          needItemId: n.id,
          needName: n.name,
          haveQty: h.qty,
          needQty: n.qty,
          userIdHave: userId,
          userIdNeed: n.userId,
          otherUser: targetUser
            ? {
                displayName: targetUser.displayName,
                location: targetUser.location,
                bio: targetUser.bio,
              }
            : null,
          distanceKm: distanceValue,
          score,
          reasons: positiveReasons.slice(0, 4),
          breakdown,
        });
      }
    }

    suggestions.sort((a, b) => b.score - a.score);

    const end = offset + limit;
    const paged = suggestions.slice(offset, end);
    const storeLimit = Math.max(end, 200);
    const storeCandidates = suggestions.slice(0, storeLimit);

    await prisma.match.deleteMany({ where: { userId } });
    if (storeCandidates.length > 0) {
      const seen = new Set();
      const rows = [];
      for (const s of storeCandidates) {
        const key = `${userId}:${s.haveItemId}:${s.needItemId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({
          userId,
          haveItemId: s.haveItemId,
          needItemId: s.needItemId,
          score: s.score,
          distanceKm: s.distanceKm,
          reasons: s.reasons ? JSON.stringify(s.reasons) : null,
          breakdown: s.breakdown ? JSON.stringify(s.breakdown) : null,
          status: "ACTIVE",
        });
      }

      if (rows.length > 0) {
        await prisma.match.createMany({ data: rows });
      }
    }

    return res.json({
      suggestions: paged,
      meta: {
        returned: paged.length,
        totalCandidates: suggestions.length,
        offset,
        limit,
        minScore,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
