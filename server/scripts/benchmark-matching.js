import { performance } from "node:perf_hooks";
import { computeScore } from "../src/lib/matching.js";

function randomItem(prefix, index) {
  return {
    name: `${prefix} Item ${index}`,
    qty: Math.floor(Math.random() * 5) + 1,
    notes: index % 3 === 0 ? "summer" : "",
  };
}

const HAVE_COUNT = Number.parseInt(process.env.BENCH_HAVE_COUNT || "50", 10);
const NEED_COUNT = Number.parseInt(process.env.BENCH_NEED_COUNT || "200", 10);

const haveItems = Array.from({ length: HAVE_COUNT }, (_, i) => randomItem("Have", i));
const needItems = Array.from({ length: NEED_COUNT }, (_, i) => randomItem("Need", i));

const start = performance.now();
let scores = 0;

for (const h of haveItems) {
  for (const n of needItems) {
    const result = computeScore(h, n);
    scores += result.score;
  }
}

const end = performance.now();
const total = HAVE_COUNT * NEED_COUNT;
const avgMs = (end - start) / total;

console.log(`Scored ${total} pairs in ${(end - start).toFixed(2)}ms`);
console.log(`Average ${avgMs.toFixed(4)}ms per pair, checksum ${scores}`);
