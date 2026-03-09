import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { fetchFrostForecast } from "../lib/weather.js";
import { buildTimingFlags, parseZone, zoneFrostWindow } from "../lib/timing.js";

const router = Router();
router.use(requireAuth);

function normalizeName(value) {
  return (value || "").trim().toLowerCase();
}

router.get("/flags", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [user, items, plants] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          latitude: true,
          longitude: true,
          gardens: {
            orderBy: { updatedAt: "desc" },
            take: 1,
            select: { id: true, name: true, usdaZone: true },
          },
        },
      }),
      prisma.inventoryItem.findMany({
        where: { userId, qty: { gt: 0 } },
        orderBy: { updatedAt: "desc" },
        include: { plant: true },
      }),
      prisma.plant.findMany(),
    ]);

    if (!user) return res.status(404).json({ error: "User not found" });

    const plantMap = new Map(
      plants.map((plant) => [normalizeName(plant.commonName), plant])
    );

    const now = new Date();
    const zone = parseZone(user.gardens?.[0]?.usdaZone);
    const zoneInfo = zoneFrostWindow(zone);
    const forecast = await fetchFrostForecast({
      latitude: user.latitude,
      longitude: user.longitude,
    });

    const flagsByItem = items.map((item) => {
      const plant = item.plant || plantMap.get(normalizeName(item.name));
      const flags = buildTimingFlags({ item, plant, now, zoneInfo, forecast });
      return {
        itemId: item.id,
        name: item.name,
        status: item.status,
        qty: item.qty,
        plantId: plant?.id || null,
        plant: plant
          ? {
              commonName: plant.commonName,
              season: plant.season,
              daysToMaturity: plant.daysToMaturity,
              frostSensitivity: plant.frostSensitivity,
            }
          : null,
        flags,
      };
    });

    res.json({
      generatedAt: now.toISOString(),
      flags: flagsByItem,
      stats: {
        totalItems: items.length,
        flaggedItems: flagsByItem.filter((item) => item.flags.length > 0).length,
      },
      meta: {
        zone: zoneInfo?.zone || null,
        forecast: forecast
          ? {
              minTempC: forecast.minTempC,
              minDate: forecast.minDate,
              frostLikely: forecast.frostLikely,
              thresholdC: forecast.thresholdC,
            }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
