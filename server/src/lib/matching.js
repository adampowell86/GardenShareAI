function levenshtein(a = "", b = "") {
  if (a === b) return 0;
  const matrix = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const distance = levenshtein(a.toLowerCase(), b.toLowerCase());
  return 1 - distance / Math.max(a.length, b.length, 1);
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

function mergeSets(...sets) {
  const merged = new Set();
  sets.forEach((set) => {
    if (!set) return;
    for (const value of set) merged.add(value);
  });
  return merged;
}

function intersectionSize(a, b) {
  if (!a || !b || a.size === 0 || b.size === 0) return 0;
  let count = 0;
  for (const item of a) {
    if (b.has(item)) count += 1;
  }
  return count;
}

export function seasonForMonth(monthIndex) {
  if ([11, 0, 1].includes(monthIndex)) return "winter";
  if ([2, 3, 4].includes(monthIndex)) return "spring";
  if ([5, 6, 7].includes(monthIndex)) return "summer";
  return "fall";
}

export function seasonFromText(text = "") {
  const lower = text.toLowerCase();
  if (lower.includes("winter")) return "winter";
  if (lower.includes("spring")) return "spring";
  if (lower.includes("summer")) return "summer";
  if (lower.includes("fall") || lower.includes("autumn")) return "fall";
  return null;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

export function distanceKm(a, b) {
  if (!a || !b) return null;
  const lat1 = a.latitude;
  const lon1 = a.longitude;
  const lat2 = b.latitude;
  const lon2 = b.longitude;
  if ([lat1, lon1, lat2, lon2].some((v) => typeof v !== "number")) {
    return null;
  }

  const radius = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  const aVal =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) ** 2;
  const cVal = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
  return Number((radius * cVal).toFixed(2));
}

export function buildRarityMap(needItems = []) {
  return needItems.reduce((acc, item) => {
    const key = (item.name || "").toLowerCase();
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

// Compute a human-friendly scoring breakdown so we can explain matches.
export function computeScore(
  have,
  need,
  {
    rarityMap = {},
    now = new Date(),
    distanceKm: distanceValue,
    radiusKm,
    viewerInterests,
    penalizeMissingDistance = false,
  } = {}
) {
  let score = 50;
  const reasons = [];
  const breakdown = [{ label: "Baseline compatibility", delta: 50, detail: "Starting point for viable HAVE/NEED pair." }];

  const haveName = (have?.name || "").trim();
  const needName = (need?.name || "").trim();
  const haveNameLc = have?.__nameLower || haveName.toLowerCase();
  const needNameLc = need?.__nameLower || needName.toLowerCase();
  const havePlant = have?.plant || null;
  const needPlant = need?.plant || null;
  const havePlantId = have?.plantId || havePlant?.id || null;
  const needPlantId = need?.plantId || needPlant?.id || null;

  function add(label, delta, detail) {
    if (!delta) return;
    score += delta;
    breakdown.push({ label, delta, detail });
    const badge = delta > 0 ? `+${delta}` : `${delta}`;
    reasons.push(`${label} (${badge})`);
  }

  if (havePlantId && needPlantId && havePlantId === needPlantId) {
    add("Plant profile match", 20, "Both items use the same plant profile");
  }

  if (haveNameLc && needNameLc) {
    if (haveNameLc === needNameLc) {
      add("Exact name match", 25, "Both gardeners listed the same item");
    } else {
      const sim = similarity(haveName, needName);
      const simBoost = Math.round(sim * 20);
      add("Name similarity", simBoost, `Names are ${Math.round(sim * 100)}% similar`);
    }
  }

  const haveKeywords = have?.__keywords
    || keywordSet(`${have?.name || ""} ${have?.notes || ""} ${havePlant?.commonName || ""}`);
  const needKeywords = need?.__keywords
    || keywordSet(`${need?.name || ""} ${need?.notes || ""} ${needPlant?.commonName || ""}`);
  const overlap = [...haveKeywords].filter((k) => needKeywords.has(k));
  if (overlap.length > 0) {
    const overlapBoost = Math.min(10, overlap.length * 3);
    add("Shared keywords", overlapBoost, `Overlap: ${overlap.join(", ")}`);
  }

  const haveTags = have?.__tags || tagSet(havePlant?.tags || "");
  const needTags = need?.__tags || tagSet(needPlant?.tags || "");
  const tagOverlap = intersectionSize(haveTags, needTags);
  if (tagOverlap > 0) {
    const tagBoost = Math.min(12, tagOverlap * 3);
    add("Shared plant tags", tagBoost, "Plant profiles share taxonomy or use tags");
  }

  const rarity = rarityMap[needNameLc];
  if (rarity !== undefined) {
    if (rarity <= 1) add("Rare request", 10, "Few gardeners are asking for this right now");
    else if (rarity <= 3) add("Limited supply", 6, "Only a handful of gardeners need this");
    else if (rarity <= 5) add("Somewhat rare", 3, "Moderately requested item");
  }

  const qtyDelta = (have?.qty || 1) - (need?.qty || 1);
  if (qtyDelta >= 0) {
    const qtyBoost = Math.min(10, 3 + qtyDelta);
    add("Quantity covers request", qtyBoost, "Your supply meets or exceeds their need");
  } else {
    const penalty = Math.max(-8, qtyDelta);
    add("Quantity shortfall", penalty, "Requested qty is higher than your supply");
  }

  const currentSeason = seasonForMonth((now || new Date()).getMonth());
  const needSeason = need?.__season
    || needPlant?.season
    || seasonFromText(`${need?.name || ""} ${need?.notes || ""}`);
  const haveSeason = have?.__season
    || havePlant?.season
    || seasonFromText(`${have?.name || ""} ${have?.notes || ""}`);
  if (needSeason) {
    if (needSeason === currentSeason) add("In-season request", 5, "Requested item is in season now");
    else add("Off-season request", -2, "Requested item is outside the current season");
  }
  if (haveSeason && haveSeason === currentSeason) {
    add("You have it this season", 2, "Your offer is fresh for this season");
  }

  if (viewerInterests) {
    const interestKeywords = keywordSet(viewerInterests);
    const combined = mergeSets(haveKeywords, needKeywords, haveTags, needTags);
    const interestOverlap = intersectionSize(interestKeywords, combined);
    if (interestOverlap > 0) {
      const interestBoost = Math.min(6, 2 + interestOverlap);
      add("Matches your interests", interestBoost, "Your profile interests align with this trade");
    }
  }

  if (typeof distanceValue === "number") {
    if (distanceValue <= 5) add("Very close by", 5, "Neighbor is within 5km");
    else if (distanceValue <= 25) add("Local match", 3, "Neighbor is within 25km");
    else if (radiusKm && distanceValue > radiusKm) {
      add("Outside preferred radius", -6, "Beyond your configured distance");
    }
  }
  if (penalizeMissingDistance && typeof distanceValue !== "number") {
    add("Missing location data", -6, "Distance could not be calculated");
  }

  const finalScore = Math.max(0, Math.round(score));
  return {
    score: finalScore,
    reasons,
    breakdown,
  };
}
