-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InventoryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'HAVE',
    "notes" TEXT,
    "plantId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryItem_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_InventoryItem" ("createdAt", "id", "name", "notes", "plantId", "qty", "status", "updatedAt", "userId") SELECT "createdAt", "id", "name", "notes", "plantId", "qty", "status", "updatedAt", "userId" FROM "InventoryItem";
DROP TABLE "InventoryItem";
ALTER TABLE "new_InventoryItem" RENAME TO "InventoryItem";
CREATE INDEX "InventoryItem_userId_status_idx" ON "InventoryItem"("userId", "status");
CREATE INDEX "InventoryItem_userId_updatedAt_idx" ON "InventoryItem"("userId", "updatedAt");
CREATE INDEX "InventoryItem_status_idx" ON "InventoryItem"("status");
CREATE INDEX "InventoryItem_plantId_idx" ON "InventoryItem"("plantId");
CREATE TABLE "new_Match" (
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
    CONSTRAINT "Match_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_haveItemId_fkey" FOREIGN KEY ("haveItemId") REFERENCES "InventoryItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_needItemId_fkey" FOREIGN KEY ("needItemId") REFERENCES "InventoryItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Match" ("breakdown", "createdAt", "distanceKm", "haveItemId", "id", "needItemId", "reasons", "score", "status", "updatedAt", "userId") SELECT "breakdown", "createdAt", "distanceKm", "haveItemId", "id", "needItemId", "reasons", "score", "status", "updatedAt", "userId" FROM "Match";
DROP TABLE "Match";
ALTER TABLE "new_Match" RENAME TO "Match";
CREATE INDEX "Match_userId_score_idx" ON "Match"("userId", "score");
CREATE UNIQUE INDEX "Match_userId_haveItemId_needItemId_key" ON "Match"("userId", "haveItemId", "needItemId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
