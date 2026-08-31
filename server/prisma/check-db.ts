/**
 * Script to verify database connectivity.
 * Run: npx ts-node --project tsconfig.seed.json prisma/check-db.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔌 Checking database connection...");
  await prisma.$connect();
  console.log("✅ Connected to database!");

  const tableCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) as count 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `;
  console.log(`📊 Tables in public schema: ${tableCount[0].count}`);
}

main()
  .catch((e) => {
    console.error("❌ DB connection failed:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
