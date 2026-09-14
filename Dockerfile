# Stage 1: Build phase with modern Node 22 to satisfy engine constraints
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx tsc

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
