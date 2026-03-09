import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export function setupTestDb() {
  const prismaDir = path.join(process.cwd(), "prisma");
  const dbPath = path.join(prismaDir, "test.db");
  const templatePath = path.join(prismaDir, "dev.db");
  const databaseUrl = `file:${dbPath}`;

  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = databaseUrl;
  process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
  process.env.CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

  fs.rmSync(dbPath, { force: true });
  fs.rmSync(`${dbPath}-journal`, { force: true });

  if (fs.existsSync(templatePath)) {
    fs.copyFileSync(templatePath, dbPath);
  } else {
    execSync("npx prisma db push --skip-generate", {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "ignore",
    });
  }

  return { dbPath, databaseUrl };
}

async function disconnectPrisma() {
  try {
    const { prisma } = await import("../../src/db.js");
    await prisma.$disconnect();
  } catch {
    // Ignore disconnect errors; cleanup can still proceed.
  }
}

export async function cleanupTestDb(dbPath) {
  if (!dbPath) return;
  await disconnectPrisma();

  const files = [dbPath, `${dbPath}-journal`];
  for (const file of files) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        fs.rmSync(file, { force: true });
        break;
      } catch (err) {
        if (attempt === 2) throw err;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
  }
}
