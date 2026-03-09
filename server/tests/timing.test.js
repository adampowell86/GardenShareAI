import test from "node:test";
import assert from "node:assert/strict";
import { buildTimingFlags, parseZone, zoneFrostWindow } from "../src/lib/timing.js";

test("parseZone extracts numeric zone values", () => {
  assert.equal(parseZone("6b"), 6);
  assert.equal(parseZone("10a"), 10);
  assert.equal(parseZone("Zone 4"), 4);
  assert.equal(parseZone("unknown"), null);
});

test("zoneFrostWindow returns a zone window", () => {
  const zone = zoneFrostWindow(6);
  assert.ok(zone);
  assert.equal(zone.zone, 6);
  assert.equal(typeof zone.lastFrostMonth, "number");
});

test("buildTimingFlags adds frost risk for tender plants with forecast", () => {
  const item = { name: "Tomato", notes: "" };
  const plant = { frostSensitivity: "tender", season: "summer" };
  const flags = buildTimingFlags({
    item,
    plant,
    now: new Date("2026-10-05"),
    zoneInfo: { zone: 6, lastFrostMonth: 2, firstFrostMonth: 10 },
    forecast: { frostLikely: true, minTempC: 1, minDate: "2026-10-08" },
  });
  assert.ok(flags.some((flag) => flag.type === "FROST_RISK"));
});

test("buildTimingFlags adds harvest soon for short maturity crops", () => {
  const item = { name: "Lettuce", notes: "" };
  const plant = { daysToMaturity: 20, frostSensitivity: "hardy" };
  const flags = buildTimingFlags({
    item,
    plant,
    now: new Date("2026-04-01"),
    zoneInfo: null,
    forecast: null,
  });
  assert.ok(flags.some((flag) => flag.type === "HARVEST_SOON"));
});
