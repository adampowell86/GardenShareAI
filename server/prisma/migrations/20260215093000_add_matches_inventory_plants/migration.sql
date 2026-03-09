-- Add plantId to inventory items
ALTER TABLE "InventoryItem" ADD COLUMN "plantId" TEXT;

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "haveItemId" TEXT NOT NULL,
    "needItemId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "distanceKm" REAL,
    "reasons" TEXT,
    "breakdown" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Match_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Match_haveItemId_fkey" FOREIGN KEY ("haveItemId") REFERENCES "InventoryItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Match_needItemId_fkey" FOREIGN KEY ("needItemId") REFERENCES "InventoryItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes
CREATE UNIQUE INDEX "Match_userId_haveItemId_needItemId_key" ON "Match" ("userId", "haveItemId", "needItemId");
CREATE INDEX "Match_userId_score_idx" ON "Match" ("userId", "score");

CREATE INDEX "InventoryItem_userId_status_idx" ON "InventoryItem" ("userId", "status");
CREATE INDEX "InventoryItem_userId_updatedAt_idx" ON "InventoryItem" ("userId", "updatedAt");
CREATE INDEX "InventoryItem_status_idx" ON "InventoryItem" ("status");
CREATE INDEX "InventoryItem_plantId_idx" ON "InventoryItem" ("plantId");

CREATE INDEX "Trade_userAId_idx" ON "Trade" ("userAId");
CREATE INDEX "Trade_userBId_idx" ON "Trade" ("userBId");
CREATE INDEX "Trade_status_idx" ON "Trade" ("status");
CREATE INDEX "Trade_createdAt_idx" ON "Trade" ("createdAt");
CREATE INDEX "Trade_haveItemId_idx" ON "Trade" ("haveItemId");
CREATE INDEX "Trade_needItemId_idx" ON "Trade" ("needItemId");

CREATE INDEX "Garden_userId_idx" ON "Garden" ("userId");
CREATE INDEX "TimingFlag_userId_idx" ON "TimingFlag" ("userId");
