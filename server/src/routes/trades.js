import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { computeScore } from "../lib/matching.js";
import { parseLimit, parseOffset } from "../lib/pagination.js";

const router = Router();
router.use(requireAuth);

const RESOLVED_ITEM_STATUS = "TRADED";

// Helper to normalize a trade for the current user
function mapTradeForUser(trade, currentUserId) {
  const isUserA = trade.userAId === currentUserId;
  const haveOwner = trade.haveItem?.user;
  const needOwner = trade.needItem?.user;
  const insights = computeScore(trade.haveItem, trade.needItem);
  const highlights = insights.breakdown
    .filter((b) => b.delta > 0)
    .slice(0, 3)
    .map((b) => b.label);

  return {
    id: trade.id,
    status: trade.status,
    createdAt: trade.createdAt,
    role: isUserA ? "you-have" : "you-need",
    initiatedByYou: trade.userAId === currentUserId,
    haveItemName: trade.haveItem.name,
    needItemName: trade.needItem.name,
    haveOwnerEmail: haveOwner?.email,
    needOwnerEmail: needOwner?.email,
    otherUserEmail: isUserA ? needOwner?.email : haveOwner?.email,
    insights: {
      score: insights.score,
      highlights,
      breakdown: insights.breakdown,
    },
  };
}

async function getTradeWithRelations(id) {
  return prisma.trade.findUnique({
    where: { id },
    include: {
      haveItem: { include: { user: true } },
      needItem: { include: { user: true } },
    },
  });
}

async function assertMembership(trade, userId) {
  if (trade.userAId !== userId && trade.userBId !== userId) {
    const error = new Error("You are not part of this trade");
    error.status = 403;
    throw error;
  }
}

function assertRolePermission(trade, userId, status) {
  const isInitiator = trade.userAId === userId;
  const isRecipient = trade.userBId === userId;

  if (status === "ACCEPTED" || status === "REJECTED") {
    if (!isRecipient) {
      const error = new Error("Only the recipient can accept or reject this trade");
      error.status = 403;
      throw error;
    }
  }

  if (status === "CANCELLED") {
    if (!isInitiator) {
      const error = new Error("Only the initiator can cancel this trade");
      error.status = 403;
      throw error;
    }
  }
}

async function applyInventoryUpdate(tx, itemId, expectedStatus) {
  const item = await tx.inventoryItem.findUnique({ where: { id: itemId } });
  if (!item) {
    const error = new Error("Trade items are missing");
    error.status = 404;
    throw error;
  }
  if (item.status !== expectedStatus || item.qty < 1) {
    const error = new Error("Trade items are no longer available");
    error.status = 409;
    throw error;
  }

  const nextQty = item.qty - 1;
  const data = nextQty === 0
    ? { qty: 0, status: RESOLVED_ITEM_STATUS }
    : { qty: nextQty };

  await tx.inventoryItem.update({ where: { id: itemId }, data });
}

async function upsertReceivedItem(tx, recipientId, sourceItem) {
  if (!recipientId || !sourceItem?.name) return;
  const plantId = sourceItem.plantId ?? null;
  const existing = await tx.inventoryItem.findFirst({
    where: {
      userId: recipientId,
      status: "HAVE",
      name: sourceItem.name,
      plantId,
    },
  });

  if (existing) {
    await tx.inventoryItem.update({
      where: { id: existing.id },
      data: { qty: existing.qty + 1 },
    });
    return;
  }

  await tx.inventoryItem.create({
    data: {
      userId: recipientId,
      name: sourceItem.name,
      qty: 1,
      status: "HAVE",
      notes: sourceItem.notes || null,
      plantId,
    },
  });
}

async function setTradeStatus(id, userId, status) {
  const allowed = ["ACCEPTED", "REJECTED", "CANCELLED"];
  if (!allowed.includes(status)) {
    const error = new Error("Invalid status. Use ACCEPTED, REJECTED, or CANCELLED.");
    error.status = 400;
    throw error;
  }

  const trade = await getTradeWithRelations(id);
  if (!trade) {
    const error = new Error("Trade not found");
    error.status = 404;
    throw error;
  }

  await assertMembership(trade, userId);

  // Already in desired state, return as-is
  if (trade.status === status) {
    return mapTradeForUser(trade, userId);
  }

  // Only allow transitions from PENDING
  if (trade.status !== "PENDING") {
    const error = new Error("Trade is already resolved");
    error.status = 400;
    throw error;
  }

  assertRolePermission(trade, userId, status);

  if (status === "ACCEPTED") {
    const updated = await prisma.$transaction(async (tx) => {
      await applyInventoryUpdate(tx, trade.haveItemId, "HAVE");
      await applyInventoryUpdate(tx, trade.needItemId, "NEED");
      await upsertReceivedItem(tx, trade.needItem.userId, trade.haveItem);
      const accepted = await tx.trade.update({
        where: { id },
        data: { status },
        include: {
          haveItem: { include: { user: true } },
          needItem: { include: { user: true } },
        },
      });
      await tx.match.updateMany({
        where: {
          OR: [
            { haveItemId: trade.haveItemId },
            { needItemId: trade.needItemId },
          ],
        },
        data: { status: "TRADED" },
      });
      await tx.trade.updateMany({
        where: {
          status: "PENDING",
          NOT: { id },
          OR: [
            { haveItemId: trade.haveItemId },
            { needItemId: trade.needItemId },
          ],
        },
        data: { status: "CANCELLED" },
      });
      return accepted;
    });

    return mapTradeForUser(updated, userId);
  }

  const updated = await prisma.trade.update({
    where: { id },
    data: { status },
    include: {
      haveItem: { include: { user: true } },
      needItem: { include: { user: true } },
    },
  });

  return mapTradeForUser(updated, userId);
}

// POST /trades  -> create a pending trade
router.post("/", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { haveItemId, needItemId } = req.body || {};

    if (!haveItemId || !needItemId) {
      return res.status(400).json({ error: "haveItemId and needItemId are required" });
    }

    const haveItem = await prisma.inventoryItem.findUnique({
      where: { id: haveItemId },
    });
    const needItem = await prisma.inventoryItem.findUnique({
      where: { id: needItemId },
    });

    if (!haveItem || !needItem) {
      return res.status(404).json({ error: "One or both items not found" });
    }

    if (haveItem.status !== "HAVE" || needItem.status !== "NEED") {
      return res
        .status(400)
        .json({ error: "Item statuses must be HAVE (offer) and NEED (request)" });
    }

    // The logged-in user should own the HAVE item in this flow
    if (haveItem.userId !== userId) {
      return res
        .status(403)
        .json({ error: "You can only initiate trades for your own HAVE items" });
    }

    if (needItem.userId === userId) {
      return res
        .status(400)
        .json({ error: "You cannot create a trade with yourself" });
    }

    const existingPending = await prisma.trade.findFirst({
      where: {
        haveItemId: haveItem.id,
        needItemId: needItem.id,
        status: "PENDING",
      },
    });
    if (existingPending) {
      return res.status(409).json({ error: "A trade between these items is already pending" });
    }

    // Create trade
    const trade = await prisma.trade.create({
      data: {
        userAId: haveItem.userId,
        userBId: needItem.userId,
        haveItemId: haveItem.id,
        needItemId: needItem.id,
        status: "PENDING",
      },
      include: {
        haveItem: { include: { user: true } },
        needItem: { include: { user: true } },
      },
    });

    return res.status(201).json(mapTradeForUser(trade, userId));
  } catch (err) {
    next(err);
  }
});

// GET /trades  -> list all trades where current user is involved
router.get("/", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const statusFilter = req.query.status ? String(req.query.status).toUpperCase() : null;
    const limit = parseLimit(req.query.limit, { defaultLimit: 50, max: 200 });
    const offset = parseOffset(req.query.offset);

    const trades = await prisma.trade.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        haveItem: { include: { user: true } },
        needItem: { include: { user: true } },
      },
      take: limit,
      skip: offset,
    });

    const mapped = trades.map((t) => mapTradeForUser(t, userId));
    return res.json(mapped);
  } catch (err) {
    next(err);
  }
});

// PUT /trades/:id  -> update status (ACCEPTED, REJECTED, CANCELLED)
router.put("/:id", async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { status } = req.body || {};

    const updated = await setTradeStatus(id, userId, status);
    return res.json(updated);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
});

// POST /trades/:id/accept -> mark as ACCEPTED
router.post("/:id/accept", async (req, res, next) => {
  try {
    const updated = await setTradeStatus(req.params.id, req.user.id, "ACCEPTED");
    return res.json(updated);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
});

// POST /trades/:id/reject -> mark as REJECTED
router.post("/:id/reject", async (req, res, next) => {
  try {
    const updated = await setTradeStatus(req.params.id, req.user.id, "REJECTED");
    return res.json(updated);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
});

// POST /trades/:id/cancel -> mark as CANCELLED
router.post("/:id/cancel", async (req, res, next) => {
  try {
    const updated = await setTradeStatus(req.params.id, req.user.id, "CANCELLED");
    return res.json(updated);
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ error: err.message });
  }
});

export default router;
