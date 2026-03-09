import test from "node:test";
import assert from "node:assert/strict";
import { computeScore, distanceKm } from "../src/lib/matching.js";

test("distanceKm returns null without coordinates", () => {
  assert.equal(distanceKm({ latitude: 1, longitude: 2 }, null), null);
  assert.equal(distanceKm({ latitude: 1 }, { latitude: 2, longitude: 3 }), null);
});

test("distanceKm returns approximate km between simple points", () => {
  const value = distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 });
  assert.ok(typeof value === "number");
  assert.ok(value > 110 && value < 112);
});

test("computeScore boosts exact name matches", () => {
  const have = { name: "Tomato", qty: 3 };
  const need = { name: "Tomato", qty: 1 };
  const result = computeScore(have, need);
  assert.ok(result.score > 70);
});

test("computeScore flags matches outside preferred radius", () => {
  const have = { name: "Basil", qty: 2 };
  const need = { name: "Basil", qty: 1 };
  const result = computeScore(have, need, { distanceKm: 60, radiusKm: 25 });
  const labels = result.breakdown.map((b) => b.label);
  assert.ok(labels.includes("Outside preferred radius"));
});

test("computeScore boosts plant profile matches", () => {
  const have = {
    name: "Tomato",
    qty: 2,
    plantId: "plant-1",
    plant: { id: "plant-1", tags: "nightshade, fruit" },
  };
  const need = {
    name: "Tomato",
    qty: 1,
    plantId: "plant-1",
    plant: { id: "plant-1", tags: "nightshade" },
  };
  const result = computeScore(have, need);
  const labels = result.breakdown.map((b) => b.label);
  assert.ok(labels.includes("Plant profile match"));
});

test("computeScore boosts shared plant tags", () => {
  const have = { name: "Pepper", qty: 1, plant: { tags: "nightshade, spicy" } };
  const need = { name: "Chili", qty: 1, plant: { tags: "nightshade, heat" } };
  const result = computeScore(have, need);
  const labels = result.breakdown.map((b) => b.label);
  assert.ok(labels.includes("Shared plant tags"));
});

test("computeScore boosts matches aligned with viewer interests", () => {
  const have = { name: "Basil", qty: 2 };
  const need = { name: "Tomato", qty: 1 };
  const result = computeScore(have, need, { viewerInterests: "basil, tomatoes, herbs" });
  const labels = result.breakdown.map((b) => b.label);
  assert.ok(labels.includes("Matches your interests"));
});

test("computeScore penalizes missing distance when enabled", () => {
  const have = { name: "Mint", qty: 1 };
  const need = { name: "Mint", qty: 1 };
  const result = computeScore(have, need, { penalizeMissingDistance: true });
  const labels = result.breakdown.map((b) => b.label);
  assert.ok(labels.includes("Missing location data"));
});
