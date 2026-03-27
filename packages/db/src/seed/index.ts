import "dotenv/config";
import { db } from "../client.js";
import { heroes } from "../schema.js";
import { heroSeedData } from "./heroes.js";

async function seed() {
  console.log("Seeding heroes...");

  await db.insert(heroes).values(heroSeedData).onConflictDoNothing();

  console.log(`Inserted ${heroSeedData.length} heroes.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
