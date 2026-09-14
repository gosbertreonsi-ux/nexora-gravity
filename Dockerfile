# Use a unified, certified Node 22 image to run your application environment
FROM node:22-alpine
WORKDIR /app

# Copy dependency configuration manifests
COPY package*.json ./

# Install packages including dev dependencies so ts-node can execute scripts directly
RUN npm install

# Pull down the complete source code tree
COPY . .

EXPOSE 8080

# Execute the TypeScript server script directly to bypass compile-time file-system casing drops
CMD ["npx", "ts-node", "src/server/index.ts"]
