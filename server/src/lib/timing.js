import { seasonForMonth, seasonFromText } from "./matching.js";

const ZONE_BANDS = [
  { min: 1, max: 3, lastFrostMonth: 4, firstFrostMonth: 8 },
  { min: 4, max: 5, lastFrostMonth: 3, firstFrostMonth: 9 },
  { min: 6, max: 7, lastFrostMonth: 2, firstFrostMonth: 10 },
  { min: 8, max: 9, lastFrostMonth: 1, firstFrostMonth: 11 },
  { min: 10, max: 11, lastFrostMonth: null, firstFrostMonth: null },
];

function isTender(frostSensitivity = "") {
  const lower = frostSensitivity.toLowerCase();
  return lower.includes("tender") || lower.includes("sensitive") || lower.includes("frost");
}

function addFlag(flags, type, detail) {
  if (flags.some((flag) => flag.type === type && flag.detail === detail)) return;
  flags.push({ type, detail });
}

export function parseZone(value) {
  if (!value) return null;
  const match = String(value).trim().match(/(\d{1,2})/);
  if (!match) return null;
  const zone = Number.parseInt(match[1], 10);
  if (Number.isNaN(zone) || zone < 1 || zone > 11) return null;
  return zone;
}

export function zoneFrostWindow(zoneNumber) {
  if (!zoneNumber) return null;
  const band = ZONE_BANDS.find((entry) => zoneNumber >= entry.min && zoneNumber <= entry.max);
  if (!band) return null;
  return {
    zone: zoneNumber,
    lastFrostMonth: band.lastFrostMonth,
    firstFrostMonth: band.firstFrostMonth,
  };
}

export function buildTimingFlags({ item, plant, now, zoneInfo, forecast }) {
  const flags = [];
  const currentSeason = seasonForMonth(now.getMonth());
  const season = plant?.season || seasonFromText(`${item?.name || ""} ${item?.notes || ""}`);

  if (season && season === currentSeason) {
    addFlag(flags, "PLANT_NOW", `In-season (${season})`);
  }

  const days = plant?.daysToMaturity;
  if (typeof days === "number") {
    if (days <= 30) {
      addFlag(flags, "HARVEST_SOON", `${days} days to maturity`);
    } else if (days <= 60) {
      addFlag(flags, "PLANT_NOW", `${days} days to maturity`);
    }
  }

  const tender = isTender(plant?.frostSensitivity || "");
  if (tender && zoneInfo) {
    const month = now.getMonth();
    if (zoneInfo.lastFrostMonth !== null && month <= zoneInfo.lastFrostMonth) {
      addFlag(flags, "FROST_RISK", `Last frost not passed for zone ${zoneInfo.zone}`);
    }
    if (zoneInfo.firstFrostMonth !== null && month >= zoneInfo.firstFrostMonth - 1) {
      addFlag(flags, "FROST_RISK", `First frost approaching for zone ${zoneInfo.zone}`);
    }

    if (season && zoneInfo.lastFrostMonth !== null) {
      const plantWindowStart = Math.max(0, zoneInfo.lastFrostMonth - 1);
      const plantWindowEnd = Math.min(11, zoneInfo.lastFrostMonth + 2);
      if (month >= plantWindowStart && month <= plantWindowEnd) {
        addFlag(flags, "PLANT_NOW", `Zone ${zoneInfo.zone} planting window`);
      }
    }
  }

  if (tender && forecast?.frostLikely) {
    const detail = forecast.minDate
      ? `Frost forecast on ${forecast.minDate} (${forecast.minTempC}C)`
      : `Frost forecast (${forecast.minTempC}C)`;
    addFlag(flags, "FROST_RISK", detail);
  }

  return flags;
}
