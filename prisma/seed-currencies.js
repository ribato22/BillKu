/**
 * Seed Currencies for BillKu
 * This script is run during Docker container initialization
 */

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const currencies = [
  {
    code: "IDR",
    name: "Indonesian Rupiah",
    symbol: "Rp",
    minorUnit: 0,
    symbolPosition: "prefix",
  },
  {
    code: "USD",
    name: "US Dollar",
    symbol: "$",
    minorUnit: 2,
    symbolPosition: "prefix",
  },
  {
    code: "SGD",
    name: "Singapore Dollar",
    symbol: "S$",
    minorUnit: 2,
    symbolPosition: "prefix",
  },
  {
    code: "EUR",
    name: "Euro",
    symbol: "€",
    minorUnit: 2,
    symbolPosition: "prefix",
  },
  {
    code: "JPY",
    name: "Japanese Yen",
    symbol: "¥",
    minorUnit: 0,
    symbolPosition: "prefix",
  },
  {
    code: "AUD",
    name: "Australian Dollar",
    symbol: "A$",
    minorUnit: 2,
    symbolPosition: "prefix",
  },
  {
    code: "GBP",
    name: "British Pound",
    symbol: "£",
    minorUnit: 2,
    symbolPosition: "prefix",
  },
  {
    code: "MYR",
    name: "Malaysian Ringgit",
    symbol: "RM",
    minorUnit: 2,
    symbolPosition: "prefix",
  },
];

async function seed() {
  console.log("🌱 Seeding currencies...");

  for (const c of currencies) {
    await prisma.currency.upsert({
      where: { code: c.code },
      update: {
        name: c.name,
        symbol: c.symbol,
        minorUnit: c.minorUnit,
        symbolPosition: c.symbolPosition,
      },
      create: c,
    });
  }

  const count = await prisma.currency.count();
  console.log(`✅ Currencies seeded! (${count} total)`);
}

seed()
  .catch((e) => {
    console.error("❌ Error seeding:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
