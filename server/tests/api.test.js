import test from "node:test";
import assert from "node:assert/strict";
import { setupTestDb, cleanupTestDb } from "./helpers/testDb.js";
import { createTestClient } from "./helpers/testClient.js";

let server;
let baseUrl;
let dbPath;

test.before(async () => {
  const setup = setupTestDb();
  dbPath = setup.dbPath;
  const { default: app } = await import("../src/app.js");
  server = app.listen(0);
  const address = server.address();
  baseUrl = `http://localhost:${address.port}`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await cleanupTestDb(dbPath);
});

test("csrf blocks unsafe requests without token", async () => {
  const res = await fetch(`${baseUrl}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "nope@example.com", password: "Password123!" }),
  });
  assert.equal(res.status, 403);
});

test("auth, inventory, matching, and trade flows", async () => {
  const clientA = createTestClient(baseUrl);
  const clientB = createTestClient(baseUrl);

  await clientA.request("/health");
  await clientB.request("/health");

  const signupA = await clientA.requestJson("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email: "alice@example.com", password: "Password123!" }),
  });
  assert.equal(signupA.res.status, 201);

  const signupB = await clientB.requestJson("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email: "bob@example.com", password: "Password123!" }),
  });
  assert.equal(signupB.res.status, 201);

  const refresh = await clientA.requestJson("/auth/refresh", { method: "POST" });
  assert.equal(refresh.res.status, 200);

  const have = await clientA.requestJson("/inventory/have", {
    method: "POST",
    body: JSON.stringify({ name: "Tomato", qty: 1 }),
  });
  assert.equal(have.res.status, 201);

  const need = await clientB.requestJson("/inventory/need", {
    method: "POST",
    body: JSON.stringify({ name: "Tomato", qty: 1 }),
  });
  assert.equal(need.res.status, 201);

  const suggestions = await clientA.requestJson("/matching/suggestions");
  assert.ok(Array.isArray(suggestions.data.suggestions));

  const trade = await clientA.requestJson("/trades", {
    method: "POST",
    body: JSON.stringify({ haveItemId: have.data.id, needItemId: need.data.id }),
  });
  assert.equal(trade.res.status, 201);

  const accepted = await clientB.requestJson(`/trades/${trade.data.id}/accept`, {
    method: "POST",
  });
  assert.equal(accepted.res.status, 200);
  assert.equal(accepted.data.status, "ACCEPTED");
});
