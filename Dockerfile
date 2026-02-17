# ===== BACKEND DOCKERFILE =====
# BillKu API - NestJS Backend with Puppeteer for PDF Generation

# Stage 1: Dependencies
FROM node:22-slim AS deps
WORKDIR /app

# Install dependencies needed for Puppeteer and bcrypt build
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    python3 \
    make \
    g++ \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer to skip downloading Chrome (we use system Chromium)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev --ignore-scripts && \
    npm_config_nodedir=/usr/local npm rebuild bcrypt --build-from-source

# Stage 2: Builder
FROM node:22-slim AS builder
WORKDIR /app

# Install openssl for Prisma to detect correct engine binary
RUN apt-get update && apt-get install -y openssl --no-install-recommends && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .

# Generate Prisma client (with retry for intermittent DNS)
RUN npx prisma generate || (sleep 5 && npx prisma generate) || (sleep 10 && npx prisma generate)

# Build NestJS application
RUN npm run build

# Stage 3: Runner
FROM node:22-slim AS runner
WORKDIR /app

# Install Chromium and dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/package.json ./package.json

# Copy entrypoint and seed script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
COPY prisma/seed-currencies.js /app/prisma/seed-currencies.js
RUN chmod +x /app/docker-entrypoint.sh

# Create data directory for SQLite
RUN mkdir -p /app/data && chmod 777 /app/data

# Create directory for WhatsApp sessions
RUN mkdir -p /app/.wa-sessions && chmod 777 /app/.wa-sessions

EXPOSE 4000

# Use entrypoint for auto-migration and seed
ENTRYPOINT ["/app/docker-entrypoint.sh"]
