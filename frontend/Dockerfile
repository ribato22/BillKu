# ===== FRONTEND DOCKERFILE =====
# BillKu Frontend - Next.js 16 with React 19

# Stage 1: Dependencies
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

# Stage 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ARG BACKEND_URL=http://localhost:4000
ENV NEXT_TELEMETRY_DISABLED=1 \
  NODE_ENV=production \
  BACKEND_URL=${BACKEND_URL}

# Build Next.js application
RUN npm run build

# Stage 3: Runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
  adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs

EXPOSE 4001

ENV PORT=4001 \
  HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
