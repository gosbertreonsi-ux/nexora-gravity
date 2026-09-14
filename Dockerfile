# Stage 1: Build phase with modern Node 22 to satisfy engine constraints
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
# Clean install packages including dev dependencies
RUN npm install
COPY . .
# FIXED: Instruct the compiler to transpile raw source files without failing on ambient path warnings
RUN npx tsc --skipLibCheck --declaration false

# Stage 2: Minimalist production runtime phase using identical Node 22
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

# Pull the compiled server distributions from the builder slice safely
COPY --from=builder /app/dist ./dist

EXPOSE 8080
CMD ["node", "dist/server/index.js"]
