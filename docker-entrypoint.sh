#!/bin/sh
set -e

echo "🚀 Starting BillKu API..."

if [ "${1:-}" = "baseline-v1.1.1" ]; then
  exec node prisma/baseline-v1.1.1.js
fi

echo "📦 Running database migrations..."
./node_modules/.bin/prisma migrate deploy

# Seed currencies
echo "🌱 Seeding initial data..."
node prisma/seed-currencies.js

# Start the application
echo "✅ Starting application..."
exec node dist/src/main.js
