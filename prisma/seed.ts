import { PrismaClient, SymbolPosition } from "@prisma/client";

const prisma = new PrismaClient();

const currencies = [
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", minorUnit: 0, symbolPosition: SymbolPosition.prefix },
  { code: "USD", name: "US Dollar", symbol: "$", minorUnit: 2, symbolPosition: SymbolPosition.prefix },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", minorUnit: 2, symbolPosition: SymbolPosition.prefix },
  { code: "EUR", name: "Euro", symbol: "€", minorUnit: 2, symbolPosition: SymbolPosition.prefix },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", minorUnit: 0, symbolPosition: SymbolPosition.prefix },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", minorUnit: 2, symbolPosition: SymbolPosition.prefix },
  { code: "GBP", name: "British Pound", symbol: "£", minorUnit: 2, symbolPosition: SymbolPosition.prefix },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", minorUnit: 2, symbolPosition: SymbolPosition.prefix },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", minorUnit: 2, symbolPosition: SymbolPosition.prefix },
  { code: "THB", name: "Thai Baht", symbol: "฿", minorUnit: 2, symbolPosition: SymbolPosition.prefix },
];

async function main() {
  for (const currency of currencies) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      update: {
        name: currency.name,
        symbol: currency.symbol,
        minorUnit: currency.minorUnit,
        symbolPosition: currency.symbolPosition,
      },
      create: currency,
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
