import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

const PLANTS = [
  { commonName: "Tomato", tags: "nightshade,fruit", frostSensitivity: "tender", daysToMaturity: 70, season: "summer" },
  { commonName: "Basil", tags: "herb,mediterranean", frostSensitivity: "tender", daysToMaturity: 30, season: "summer" },
  { commonName: "Lettuce", tags: "leafy,cool-season", frostSensitivity: "hardy", daysToMaturity: 45, season: "spring" },
  { commonName: "Carrot", tags: "root,cool-season", frostSensitivity: "hardy", daysToMaturity: 70, season: "spring" },
  { commonName: "Pepper", tags: "nightshade,fruit", frostSensitivity: "tender", daysToMaturity: 75, season: "summer" },
  { commonName: "Zucchini", tags: "squash,summer", frostSensitivity: "tender", daysToMaturity: 50, season: "summer" },
  { commonName: "Kale", tags: "leafy,cool-season", frostSensitivity: "hardy", daysToMaturity: 55, season: "fall" },
];

async function main() {
  for (const plant of PLANTS) {
    const existing = await prisma.plant.findFirst({
      where: { commonName: plant.commonName },
    });
    if (existing) {
      await prisma.plant.update({ where: { id: existing.id }, data: plant });
    } else {
      await prisma.plant.create({ data: plant });
    }
  }
  console.log(`Seeded ${PLANTS.length} plants.`);
}

main()
  .catch((err) => {
    console.error("Failed to seed plants:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
