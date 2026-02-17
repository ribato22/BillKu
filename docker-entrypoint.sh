#!/bin/sh
set -e

echo "🚀 Starting BillKu API..."

# Run database migrations
echo "📦 Running database migrations..."
npx prisma migrate deploy || true

# Push any schema changes not covered by migrations (e.g. new fields)
echo "📦 Syncing schema..."
npx prisma db push --accept-data-loss 2>/dev/null || true

# Seed currencies
echo "🌱 Seeding initial data..."
node /app/prisma/seed-currencies.js

# Start the application
echo "✅ Starting application..."
exec node dist/src/main.js
