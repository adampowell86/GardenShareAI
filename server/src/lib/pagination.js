function toInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function parseLimit(value, { defaultLimit = 50, max = 200 } = {}) {
  const parsed = toInt(value, defaultLimit);
  if (parsed < 1) return defaultLimit;
  return Math.min(parsed, max);
}

export function parseOffset(value) {
  const parsed = toInt(value, 0);
  return parsed < 0 ? 0 : parsed;
}
