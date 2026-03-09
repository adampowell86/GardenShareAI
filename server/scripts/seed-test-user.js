import dotenv from "dotenv";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const DEFAULT_EMAIL = "test@google.com";
const DEFAULT_PASSWORD = "TestPassword123!";

const emailRaw = process.env.TEST_USER_EMAIL || DEFAULT_EMAIL;
const password = process.env.TEST_USER_PASSWORD || DEFAULT_PASSWORD;
const email = emailRaw.trim().toLowerCase();

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed test user in production.");
  process.exit(1);
}

if (!email) {
  console.error("TEST_USER_EMAIL is required.");
  process.exit(1);
}

if (!password || password.length < 8) {
  console.error("TEST_USER_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash }
  });

  console.log(`Seeded test user: ${user.email}`);
  if (process.env.SHOW_TEST_USER_PASSWORD === "true") {
    console.log(`Password: ${password}`);
  }
}

main()
  .catch((err) => {
    console.error("Failed to seed test user:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
