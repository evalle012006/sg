# Install dependencies only when needed
FROM node:18-alpine AS deps

# Create app directory
WORKDIR /app

# Install OS deps for sharp, puppeteer, etc.
RUN apk add --no-cache \
  libc6-compat \
  libstdc++ \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont \
  build-base \
  python3 \
  g++ \
  make \
  && npm install -g sharp

# Copy only package files to install dependencies
COPY package.json package-lock.json* ./

RUN npm ci

# Rebuild the source code only when needed
FROM node:18-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY . .

# Build the Next.js app
RUN npm run build

# Production image, copy all files and serve
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV production

# Required for puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV CHROMIUM_PATH=/usr/bin/chromium-browser

# Install chromium for puppeteer
RUN apk add --no-cache \
  chromium \
  nss \
  freetype \
  harfbuzz \
  ca-certificates \
  ttf-freefont

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Expose the port the app runs on
EXPOSE 3000

# Start the app
CMD ["node_modules/.bin/next", "start", "-p", "3000"]
